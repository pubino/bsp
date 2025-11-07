const request = require('supertest');
const { chromium } = require('playwright');

const app = require('../../server');

// Determine test target based on environment
const isInContainer = process.env.NODE_ENV === 'test';
const testTarget = isInContainer ? 'http://drupal-ui-automation:3000' : app;

describe('Browser Auto-Launch and Navigation Tests', () => {
  let server;
  let testApp;

  beforeAll(async () => {
    if (!isInContainer) {
      // Start the server for testing when running on host
      testApp = app.listen(3001);
    }
  });

  afterAll(async () => {
    if (!isInContainer && testApp) {
      // Close the test server when running on host
      await testApp.close();
    }
  });

  // Helper function to get the correct test target
  const getTestTarget = () => isInContainer ? request(testTarget) : request(testApp);

  beforeEach(async () => {
    // Clean up any existing browser sessions before each test
    try {
      await getTestTarget()
        .post('/test/cleanup')
        .expect(200);
    } catch (error) {
      // Cleanup might fail if no sessions exist, that's ok
      console.log('Cleanup before test:', error.message);
    }
  });

  describe('Browser Auto-Launch Prevention', () => {
    test('should not auto-launch browser on server start', async () => {
      // Test that the server starts without launching a browser
      // This is validated by checking that /playwright/ready returns false initially
      const response = await getTestTarget()
        .get('/playwright/ready')
        .expect(200);

      // Initially, no browser should be running
      expect(response.body.ready).toBe(false);
      expect(response.body.browser).toBe(false);
      expect(response.body.context).toBe(false);
      expect(response.body.page).toBe(false);
    });

    test('should only launch browser when explicitly requested via API', async () => {
      // Initially no browser
      let response = await getTestTarget()
        .get('/playwright/ready')
        .expect(200);

      expect(response.body.ready).toBe(false);

      // Create interactive context - this should launch the browser
      const interactiveResponse = await getTestTarget()
        .post('/login/interactive')
        .expect(200);

      expect(interactiveResponse.body.success).toBe(true);

      // Now browser should be ready
      response = await getTestTarget()
        .get('/playwright/ready')
        .expect(200);

      expect(response.body.ready).toBe(true);
      expect(response.body.browser).toBe(true);
      expect(response.body.context).toBe(true);
      expect(response.body.page).toBe(true);
    });
  });

  describe('Default URL Auto-Load Prevention', () => {
    test('should start browser with about:blank, not default URL', async () => {
      // Create interactive context
      const interactiveResponse = await getTestTarget()
        .post('/login/interactive')
        .expect(200);

      expect(interactiveResponse.body.success).toBe(true);

      // Check that the page is at about:blank, not the default URL
      const pageResponse = await getTestTarget()
        .get('/debug/page')
        .expect(200);

      expect(pageResponse.body.success).toBe(true);
      expect(pageResponse.body.url).toBe('about:blank');
      expect(pageResponse.body.title).toBe('');
      expect(pageResponse.body.bodyVisible).toBe(true);

      // Ensure it's NOT at the default URL
      const defaultUrl = process.env.DEFAULT_LOGIN_URL || 'https://example.com/login';
      expect(pageResponse.body.url).not.toBe(defaultUrl);
      expect(pageResponse.body.url).not.toContain('princeton.edu');
    });

    test('should not automatically navigate to default URL', async () => {
      // Create interactive context
      await getTestTarget()
        .post('/login/interactive')
        .expect(200);

      // Wait a moment to ensure no automatic navigation occurs
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check that page is still at about:blank
      const pageResponse = await getTestTarget()
        .get('/debug/page')
        .expect(200);

      expect(pageResponse.body.url).toBe('about:blank');
      expect(pageResponse.body.title).toBe('');
    });

    test('should provide manual navigation instructions', async () => {
      const response = await getTestTarget()
        .post('/login/interactive')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.instructions).toContain('about:blank');
      expect(response.body.instructions).toContain('Manually navigate');
      expect(response.body.instructions).toContain(process.env.DEFAULT_LOGIN_URL || 'login');
    });
  });

  describe('Playwright Control Validation', () => {
    test('should have browser under Playwright control', async () => {
      // Create interactive context
      await getTestTarget()
        .post('/login/interactive')
        .expect(200);

      // Check that browser is ready and controllable
      const readyResponse = await getTestTarget()
        .get('/playwright/ready')
        .expect(200);

      expect(readyResponse.body.ready).toBe(true);
      expect(readyResponse.body.browser).toBe(true);
      expect(readyResponse.body.context).toBe(true);
      expect(readyResponse.body.page).toBe(true);

      // Should be able to take screenshots (indicating control)
      const screenshotResponse = await getTestTarget()
        .get('/debug/screenshot')
        .expect(200);

      expect(screenshotResponse.body.success).toBe(true);
    });

    test('should maintain control without automatic navigation', async () => {
      // Create interactive context
      await getTestTarget()
        .post('/login/interactive')
        .expect(200);

      // Verify initial state
      let pageResponse = await getTestTarget()
        .get('/debug/page')
        .expect(200);

      expect(pageResponse.body.url).toBe('about:blank');

      // Wait and verify it stays at about:blank
      await new Promise(resolve => setTimeout(resolve, 3000));

      pageResponse = await getTestTarget()
        .get('/debug/page')
        .expect(200);

      expect(pageResponse.body.url).toBe('about:blank');
      expect(pageResponse.body.bodyVisible).toBe(true);
    });
  });
});