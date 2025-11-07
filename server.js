const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const PlaywrightManager = require('./src/playwrightManager');

console.log('Server.js starting...');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const fs = require('fs');
  fs.appendFileSync('/tmp/requests.log', `${new Date().toISOString()} ${req.method} ${req.url}\n`);
  next();
});

// Initialize Playwright manager
const playwrightManager = new PlaywrightManager();

// Routes

// Test route
app.get('/test', (req, res) => {
  const fs = require('fs');
  fs.appendFileSync('/tmp/test.log', `Test route hit at ${new Date().toISOString()}\n`);
  res.json({ message: 'Test route works' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'drupal-ui-automation'
  });
});

// Playwright readiness check
app.get('/playwright/ready', async (req, res) => {
  try {
    const isReady = playwrightManager.isReady();
    res.json({
      ready: isReady,
      browser: !!playwrightManager.browser,
      context: !!playwrightManager.context,
      page: !!playwrightManager.page
    });
  } catch (error) {
    res.status(500).json({
      ready: false,
      error: error.message
    });
  }
});

// Interactive login - creates fresh browser context for VNC access
app.post('/login/interactive', async (req, res) => {
  try {
    // Close any existing context to start fresh
    await playwrightManager.close();

    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Create new interactive context
    const { context, page } = await playwrightManager.createInteractiveContext();

    // Small delay to ensure context is fully ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return connection info for noVNC access
    // In a real deployment, this would include the actual noVNC URL
    const novncUrl = process.env.NOVNC_URL || 'http://localhost:8080/vnc.html';

    res.json({
      success: true,
      message: 'Interactive login context created',
      novncUrl: novncUrl,
      instructions: `Open the noVNC URL in a browser. The browser will start with about:blank. Manually navigate to ${process.env.DEFAULT_LOGIN_URL || 'your Drupal login page'} and log in. Your session will be captured for programmatic use.`,
      contextId: Date.now().toString()
    });
  } catch (error) {
    console.error('Interactive login error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      suggestion: 'Check browser launch configuration and Xvfb display'
    });
  }
});

// Check authentication status
app.get('/login/check', async (req, res) => {
  try {
    if (!playwrightManager.isReady()) {
      return res.json({
        authenticated: false,
        reason: 'No active browser session'
      });
    }

    const authStatus = await playwrightManager.checkAuthentication();
    res.json(authStatus);
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({
      authenticated: false,
      error: error.message
    });
  }
});

// Navigate to default login URL programmatically
app.post('/login/navigate', async (req, res) => {
  try {
    if (!playwrightManager.isReady()) {
      return res.status(400).json({
        success: false,
        error: 'No active browser session. Call /login/interactive first.'
      });
    }

    const defaultUrl = process.env.DEFAULT_LOGIN_URL || 'https://example.com/login';
    console.log('Navigating to default login URL:', defaultUrl);
    
    await playwrightManager.page.goto(defaultUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    res.json({
      success: true,
      message: 'Navigated to default login URL',
      url: defaultUrl,
      instructions: 'Complete login manually via noVNC interface, then save the session with /login/save'
    });
  } catch (error) {
    console.error('Navigation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      suggestion: 'Check if the URL is accessible and try again'
    });
  }
});

// Save current authentication state
app.post('/login/save', async (req, res) => {
  try {
    if (!playwrightManager.isReady()) {
      return res.status(400).json({
        success: false,
        error: 'No active browser session to save'
      });
    }

    await playwrightManager.saveStorageState();
    res.json({
      success: true,
      message: 'Authentication state saved'
    });
  } catch (error) {
    console.error('Save auth state error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Load saved authentication state
app.post('/login/load', async (req, res) => {
  try {
    await playwrightManager.close(); // Close any existing session
    const { context, page } = await playwrightManager.loadAuthenticatedContext();

    res.json({
      success: true,
      message: 'Authentication state loaded'
    });
  } catch (error) {
    console.error('Load auth state error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug screenshot
app.get('/debug/screenshot', async (req, res) => {
  try {
    if (!playwrightManager.isReady()) {
      return res.status(400).json({
        error: 'No active browser session for screenshot'
      });
    }

    const screenshotPath = await playwrightManager.takeScreenshot();
    res.json({
      success: true,
      screenshotPath: screenshotPath,
      message: 'Screenshot saved to /tmp'
    });
  } catch (error) {
    console.error('Screenshot error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Debug page info
app.get('/debug/page', async (req, res) => {
  try {
    if (!playwrightManager.isReady()) {
      return res.status(400).json({
        error: 'No active browser session'
      });
    }

    // Wait a moment to ensure navigation is complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const url = playwrightManager.page.url();
    const title = await playwrightManager.page.title();
    const isVisible = await playwrightManager.page.isVisible('body');
    
    console.log('Debug page info - URL:', url, 'Title:', title, 'Body visible:', isVisible);
    
    res.json({
      success: true,
      url: url,
      title: title,
      bodyVisible: isVisible,
      message: 'Page info retrieved'
    });
  } catch (error) {
    console.error('Page info error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Query available content types
app.get('/content/types', async (req, res) => {
  try {
    if (!playwrightManager.isReady()) {
      return res.status(400).json({
        success: false,
        error: 'No active browser session. Call /login/interactive first.'
      });
    }

    const result = await playwrightManager.queryContentTypes();
    res.json(result);
  } catch (error) {
    console.error('Content types query error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get detailed content information by node ID
app.get('/content/detail/:nodeId', async (req, res) => {
  const fs = require('fs');
  fs.appendFileSync('/tmp/debug.log', `Route hit with params: ${JSON.stringify(req.params)}\n`);
  try {
    fs.appendFileSync('/tmp/debug.log', 'Checking playwright manager ready\n');
    if (!playwrightManager.isReady()) {
      fs.appendFileSync('/tmp/debug.log', 'Manager not ready\n');
      return res.status(400).json({
        success: false,
        error: 'No active browser session. Call /login/interactive first.'
      });
    }

    fs.appendFileSync('/tmp/debug.log', 'Parsing nodeId\n');
    const nodeId = parseInt(req.params.nodeId);
    fs.appendFileSync('/tmp/debug.log', `Parsed nodeId: ${nodeId}\n`);
    if (isNaN(nodeId) || nodeId < 1) {
      fs.appendFileSync('/tmp/debug.log', 'Invalid nodeId\n');
      return res.status(400).json({
        success: false,
        error: 'Invalid node ID. Must be a positive integer.'
      });
    }

    fs.appendFileSync('/tmp/debug.log', 'Calling getContentDetail\n');
    const result = await playwrightManager.getContentDetail(nodeId);
    fs.appendFileSync('/tmp/debug.log', `getContentDetail returned: ${JSON.stringify(result)}\n`);
    res.json(result);
  } catch (error) {
    fs.appendFileSync('/tmp/debug.log', `Content detail error: ${error.message}\n`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get content list with pagination and filtering
app.get('/content', async (req, res) => {
  try {
    if (!playwrightManager.isReady()) {
      return res.status(400).json({
        success: false,
        error: 'No active browser session. Call /login/interactive first.'
      });
    }

    const limit = parseInt(req.query.limit) || 10;
    const contentType = req.query.type || null;
    const page = parseInt(req.query.page) || 1;

    // Validate limit
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 100'
      });
    }

    // Validate page
    if (page < 1) {
      return res.status(400).json({
        success: false,
        error: 'Page must be 1 or greater'
      });
    }

    const result = await playwrightManager.queryContent(limit, contentType, page);
    res.json(result);
  } catch (error) {
    console.error('Content query error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test cleanup endpoint - closes any running browser sessions
app.post('/test/cleanup', async (req, res) => {
  try {
    console.log('Test cleanup: Closing any existing browser sessions');
    await playwrightManager.close();
    
    res.json({
      success: true,
      message: 'Browser sessions cleaned up'
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await playwrightManager.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await playwrightManager.close();
  process.exit(0);
});

// Only start the server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Playwright ready: http://localhost:${PORT}/playwright/ready`);
  });
}

module.exports = app;