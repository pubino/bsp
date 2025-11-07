````instructions
# AI Coding Agent Instructions

## Project Overview
This is an automated Drupal 10 UI testing platform providing REST API endpoints that trigger Playwright-driven browser automation. The system runs in Docker with a headful Chromium browser, supporting both programmatic UI flows and interactive VNC-based login.

## Architecture Patterns

### Core Components
- **Express Server** (`server.js`): REST API endpoints for UI automation triggers
- **Playwright Manager** (`src/playwrightManager.js`): Browser lifecycle, context management, and UI action flows
- **Docker Container**: Bundles Node app, Playwright browsers, and Xvfb + VNC stack for headful operation

### Browser Context Management
- Use persistent `storageState.json` files in `storage/` directory for session reuse
- Browser contexts attach to headful display (Xvfb) for VNC/noVNC interactive access
- Context validation via cookie checks and page navigation tests

### API Design Patterns
- POST endpoints trigger UI actions, return JSON with success/failure + metadata
- GET endpoints provide status checks and health monitoring
- Error responses include diagnostic artifacts (screenshots, HTML dumps) saved to `/tmp` or mounted directories

## Critical Workflows

### Local Development
```bash
# Build and run with docker-compose
docker-compose up --build

# Run tests (requires running container for integration tests)
npm test
```

### Browser Operations
- Launch Chromium with `--no-sandbox` in headful mode for Docker compatibility
- Connect to Xvfb display for VNC server integration
- Persist authentication state between container restarts via mounted volumes

### Testing Strategy
- **Unit Tests**: Jest mocks for Playwright manager, test API route behavior
- **Integration Tests**: Supertest against running container with isolated browser
- **E2E Tests**: Full interactive flows using Playwright test runner

## Project Conventions

### UI Automation Flows
- Navigate Drupal admin UI programmatically for CRUD operations
- Handle Drupal-specific form patterns (CSRF tokens, AJAX submissions)
- Verify actions through UI confirmation (content lists, success messages)

### Error Handling
- Capture screenshots + page HTML on UI flow failures
- Implement retry logic with backoff for transient browser errors
- Log detailed Playwright traces for debugging

### Security Patterns
- Credentials via environment variables, never in API payloads
- API authentication layer (API keys) for production deployment
- Safe secret handling through Docker secrets or mounted volumes

### Environment Variables
Environment variables are configured in the `.env` file:
- `DEFAULT_LOGIN_URL`: URL that Chromium opens by default in interactive mode (default: instructional page)
- `DISPLAY`: X11 display for browser connection (default: :99)
- `NOVNC_URL`: noVNC interface URL for user instructions (default: http://localhost:8080/vnc.html)

## Key Files Structure
```
src/
├── server.js              # Express routes and middleware
├── playwrightManager.js   # Browser lifecycle and UI actions
└── ...

tests/
├── unit/                  # Jest unit tests with mocks
├── integration/           # Supertest API tests
└── e2e/                   # Full browser automation tests

storage/                   # Persistent browser contexts
Dockerfile                 # Multi-stage build with Playwright
docker-compose.yml         # Local dev with VNC access
supervisord.conf          # Process management in container
```

## Development Guidelines

### When Adding New UI Flows
1. Implement action in `playwrightManager.js` with proper error handling
2. Add corresponding Express route in `server.js`
3. Include unit tests with Playwright mocks
4. Update API documentation in route comments

### Browser Context Usage
- Check existing `storageState.json` before triggering login flows
- Use `/login/check` endpoint to validate current authentication state
- Handle context invalidation gracefully with re-authentication prompts

### Container Debugging
- Use `/debug/screenshot` endpoint for visual debugging
- Check `/playwright/ready` for browser health
- Access VNC via noVNC URL for interactive troubleshooting
````