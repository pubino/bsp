# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Build Sites Programmatically (BSP) is an automated Drupal 10 UI testing platform providing REST API endpoints that trigger Playwright-driven browser automation. The system runs in a containerized environment with headful Chromium, supporting both programmatic UI flows and interactive VNC-based login for sites with anti-automation detection.

## Essential Commands

### Development
```bash
# Start containerized platform
docker-compose up --build

# Local development (requires proper display setup)
npm run dev

# Check service health
curl http://localhost:3000/health
```

### Testing
```bash
# Run all tests in container (REQUIRED - tests must run in container)
npm run test:container

# Run integration tests only
npm run test:integration:container

# Run unit tests on host (fast, uses mocks)
npm test
```

**IMPORTANT**: Integration tests MUST run inside Docker containers for proper isolation and environment setup. Never run integration tests directly on the host system.

### Interactive Login Workflow
```bash
# 1. Launch browser session
curl -X POST -H "Content-Type: application/json" http://localhost:3000/login/interactive

# 2. Access via VNC for manual login
open http://localhost:8080/vnc.html

# 3. Navigate to login page (manual or programmatic)
curl -X POST -H "Content-Type: application/json" http://localhost:3000/login/navigate

# 4. Save session after login
curl -X POST -H "Content-Type: application/json" http://localhost:3000/login/save

# 5. Load saved session
curl -X POST -H "Content-Type: application/json" http://localhost:3000/login/load
```

## Architecture

### Core Components

**Express Server** (`server.js`)
- REST API endpoints for UI automation triggers
- Endpoints follow pattern: POST for actions, GET for status checks
- Error responses include diagnostic artifacts (screenshots, HTML dumps)

**Playwright Manager** (`src/playwrightManager.js`)
- Browser lifecycle management (lazy loading - only launches on explicit API calls)
- Context management with persistent storage (`storage/storageState.json`)
- UI automation flows for Drupal-specific operations
- Browser only launches when requested via API, not on server startup

**Docker Container Architecture**
- Xvfb virtual framebuffer provides headless display (`:99`)
- VNC stack: x11vnc + websockify + noVNC for web-based browser access
- supervisord orchestrates all services
- Volume mounts for persistent browser contexts and artifacts

### Browser Lifecycle

**Key Principle**: Browsers launch ONLY on explicit API calls, never on server startup. This provides:
- Resource efficiency (no idle browser processes)
- Clean state (each session starts fresh)
- Scalability (no baseline overhead)

**Launch Safety**: Browser launch is restricted to container environment (DISPLAY=:99). This prevents accidental host system browser launches during development.

**Context Management**:
- Interactive context: Fresh context for manual login via VNC
- Persistent context: Load from `storage/storageState.json` for programmatic reuse
- Context validation via cookie checks and authentication status endpoints

### Navigation Workflow

**Two Approaches**:
1. **Manual Navigation** (Recommended for anti-detection)
   - Browser starts with `about:blank`
   - User manually navigates in VNC interface
   - Avoids automation detection patterns
   - Best for sites with bot protection

2. **Programmatic Navigation** (Convenience)
   - `/login/navigate` endpoint navigates to `DEFAULT_LOGIN_URL`
   - Faster for development/testing
   - May trigger bot detection on some sites

### Schema System

Content type schemas define field extraction from Drupal forms. Schemas live in `schemas/` directory and are automatically loaded by content type machine name.

**Schema Structure**:
```json
{
  "contentType": "article",
  "fields": {
    "title": {
      "selector": "[name=\"title[0][value]\"]",
      "type": "text",
      "required": true
    }
  },
  "fallback": {
    "title": {
      "selector": "h1.page-title",
      "type": "text"
    }
  }
}
```

**Field Types**: text, textarea, checkbox, date, time, select

**Schema Usage**: Used by `/content/detail/:id` endpoint for structured data extraction from both edit and view interfaces.

## API Endpoint Patterns

### Core Endpoints
- `/health` - Service health check
- `/playwright/ready` - Browser readiness status
- `/login/interactive` - Launch interactive browser session
- `/login/check` - Verify authentication status
- `/login/save` - Save current session to storage
- `/login/load` - Load saved session from storage
- `/login/navigate` - Navigate to DEFAULT_LOGIN_URL programmatically
- `/debug/screenshot` - Capture current page screenshot
- `/debug/page` - Get current page information

### Content Endpoints
- `/content/types` - Query available content types (admin or content creator access)
- `/content` - Query existing content with pagination (params: limit, type, page)
- `/content/detail/:id` - Get detailed content data using schema-based extraction
- `/content/:nodeId` (PUT) - Update content by node ID with field values

### Content Update (PUT /content/:nodeId)
Update content by node ID. The endpoint navigates to the edit page, fills form fields, and submits the changes.

**Request Body**: JSON object with field names as keys and new values as values
```json
{
  "title": "Updated Title",
  "body": "Updated body content",
  "status": true
}
```

**Field Resolution**:
1. If a schema exists for the content type, uses schema selectors and types
2. Falls back to common Drupal field naming patterns (`fieldname[0][value]`)
3. Tries multiple alternative selectors if initial selector not found

**Supported Field Types**: text, textarea, checkbox, select, date, time

**Response**:
```json
{
  "success": true,
  "nodeId": 123,
  "message": "Content 123 updated successfully",
  "updatedFields": [
    { "field": "title", "value": "Updated Title" }
  ],
  "skippedFields": [],
  "redirectUrl": "https://example.com/node/123"
}
```

### Pagination
All `/content` responses include comprehensive pagination metadata:
- `currentPage`, `hasNextPage`, `hasPrevPage` - Navigation flags
- `totalPages` - Total pages available (enables batch processing)
- `totalItems` - Total items across all pages
- `currentPageRange` - Text description (e.g., "1-50")

## Development Guidelines

### Adding New UI Flows
1. Implement action in `src/playwrightManager.js` with proper error handling
2. Add corresponding Express route in `server.js`
3. Include unit tests with Playwright mocks in `tests/unit/`
4. Add integration tests in `tests/integration/`
5. Update API documentation (this file and README.md)

### Error Handling
- Capture screenshots + page HTML on UI flow failures
- Implement retry logic with backoff for transient browser errors
- Log detailed Playwright traces for debugging
- Always include helpful error messages in API responses

### Security
- Credentials via environment variables only (`.env` file)
- Never include credentials in API payloads or responses
- `storage/storageState.json` is gitignored for security
- Session files contain authentication cookies and may become stale

### Testing Strategy
**Unit Tests**: Fast, run on host with mocks
- Use `MockApiResponder` from `tests/mock-api-responder.js` for comprehensive API simulation
- Test individual components without real browser instances
- Run with: `npm test`

**Integration Tests**: Full environment, run in container
- Test complete API flows with real Playwright instances
- Require Docker environment with proper display setup
- Always use cleanup endpoint between tests for isolation
- Run with: `npm run test:integration:container`

**Test Isolation**: Each integration test starts with clean browser state via cleanup endpoint.

### Environment Variables
Configure in `.env` file:
- `BASE_URL` - Base URL of target Drupal site (REQUIRED)
- `DEFAULT_LOGIN_URL` - Login page URL (for reference/programmatic navigation)
- `DISPLAY` - X11 display for browser (default: `:99`)
- `NOVNC_URL` - noVNC interface URL (default: `http://localhost:8080/vnc.html`)
- `NODE_ENV` - Environment mode (development, production, test)

## Important Patterns

### Drupal Form Handling
- Handle CSRF tokens automatically via Playwright's form submission
- Wait for AJAX submissions using `waitForLoadState('networkidle')`
- Verify actions through UI confirmation (success messages, content lists)
- Use field selectors with Drupal's naming convention: `[name="field_name[0][value]"]`

### Browser Context Validation
- Check existing `storageState.json` before triggering login flows
- Use `/login/check` endpoint to validate current authentication state
- Handle context invalidation gracefully with re-authentication prompts
- Cookies become stale - re-authenticate if operations fail unexpectedly

### Container Debugging
- Use `/debug/screenshot` endpoint for visual debugging without VNC
- Check `/playwright/ready` for browser health and readiness
- Access VNC via noVNC URL for interactive troubleshooting
- Check container logs: `docker-compose logs drupal-ui-automation`

### Batch Processing
See `examples/batch-processor.js` (Node.js) and `examples/batch-processor.py` (Python) for client-side examples of:
- Using pagination metadata to determine total pages
- Fetching multiple pages concurrently or sequentially
- Aggregating and trimming results to exact counts

## Common Gotchas

1. **Browser Launch on Host**: Code prevents browser launch on host system. Always run in Docker or set `NODE_ENV=test` for testing.

2. **No Auto-Navigation**: Browser starts with `about:blank` by design. Manual navigation respects automation detection. Use `/login/navigate` only if acceptable.

3. **Test Environment**: Integration tests MUST run in container (`npm run test:integration:container`), not directly on host.

4. **Session Staleness**: Saved sessions in `storageState.json` expire. If operations fail, re-authenticate via interactive login.

5. **Display Configuration**: Browser requires DISPLAY=:99 (Xvfb display in container). This is automatically configured in docker-compose.yml.

6. **Content Type Schemas**: When adding new content type support, create corresponding schema in `schemas/` directory using content type machine name as filename.

7. **Pagination Strategy**: Sites may paginate differently. Always fetch first page with `limit=1` to get `totalPages` before batch processing.
