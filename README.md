# Build Sites Programmatically (BSP)

An API for the Drupal UI when the actual API is MIA.

## Features

- **Containerized Browser Automation**: Headful Chromium runs in Docker via Xvfb + VNC
- **Interactive Login Flow**: Manual authentication with session capture for programmatic reuse
- **REST API**: Full control over browser lifecycle and UI automation
- **VNC Access**: Real-time browser interaction via noVNC web interface
- **Session Persistence**: Browser contexts saved to persistent storage

## Architecture

### Browser Launch

```
Server Start → No Browser Processes
↓
API Call (/login/interactive) → Browser Launches
↓
Manual Navigation → Session Capture → Programmatic Reuse
```
- **Lazy Loading**: Browsers launch only when explicitly requested via API calls, not on server startup.
- **Resource Efficiency**: No idle browser processes consuming memory/CPU
- **Clean State**: Each session starts fresh, avoiding state pollution
- **Manual Navigation**: Respects automation detection
- **Scalability**: Multiple concurrent sessions possible without baseline overhead

### Containerization

- **Xvfb Display**: Virtual framebuffer provides headless display
- **VNC Stack**: x11vnc + websockify + noVNC for web-based browser access
- **Process Management**: supervisord orchestrates all services
- **Volume Mounts**: Persistent storage for browser contexts and artifacts

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development and JS examples)
- Conda/Miniconda (for Python examples)

### Launch Platform

```bash
# Start the containerized platform
docker-compose up -d

# Check health
curl http://localhost:3000/health
```

### Interactive Login Flow

1. **Trigger Browser Launch**
   ```bash
   curl -X POST -H "Content-Type: application/json" http://localhost:3000/login/interactive
   ```

2. **Access Browser via VNC**
   - Open: http://localhost:8080/vnc.html
   - Browser starts with `about:blank` (no auto-navigation)

3. **Navigate to Login Page** (Choose one option):
   
   **Option A: Manual Navigation (Recommended for anti-detection)**
   - Open: http://localhost:8080/vnc.html
   - Manually navigate to your login page in the browser
   
   **Option B: Programmatic Navigation**
   ```bash
   curl -X POST -H "Content-Type: application/json" http://localhost:3000/login/navigate
   ```

4. **Complete Login**
   - Enter your credentials and log in
   - Session will be captured automatically

5. **Verify Session**
   ```bash
   curl http://localhost:3000/login/check
   ```

### Navigation Workflow

**Two Navigation Approaches:**

1. **Manual Navigation (Anti-Detection)**
   - Browser starts with `about:blank`
   - User manually types/navigates to login URL
   - Avoids automation detection patterns
   - Best for sites with bot protection

2. **Programmatic Navigation (Convenience)**
   - API call navigates directly to `DEFAULT_LOGIN_URL`
   - Faster for development/testing
   - May trigger bot detection on some sites

**Recommended Flow:**
```bash
# 1. Launch interactive session
curl -X POST -H "Content-Type: application/json" http://localhost:3000/login/interactive

# 2. Navigate to login page (choose one)
# Option A: Manual (via VNC)
open http://localhost:8080/vnc.html
# Then manually navigate in browser

# Option B: Programmatic
curl -X POST -H "Content-Type: application/json" http://localhost:3000/login/navigate

# 3. Complete login via VNC interface
# 4. Save session for reuse
curl -X POST -H "Content-Type: application/json" http://localhost:3000/login/save
```

### Session Persistence

**Save Current Session:**
```bash
curl -X POST -H "Content-Type: application/json" http://localhost:3000/login/save
```

**Load Saved Session:**
```bash
curl -X POST -H "Content-Type: application/json" http://localhost:3000/login/load
```

**Storage Location:** Sessions are saved to `storage/storageState.json` (gitignored for security).

**Note:** Session files contain authentication cookies and may become stale. Re-authenticate if operations fail.

## 📋 API Reference

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/playwright/ready` | GET | Browser readiness status |
| `/login/interactive` | POST | Launch interactive browser session |
| `/login/check` | GET | Verify authentication status |
| `/login/save` | POST | Save current session to storage |
| `/login/load` | POST | Load saved session from storage |
| `/debug/screenshot` | GET | Capture current page screenshot |
| `/debug/page` | GET | Get current page information |
| `/login/navigate` | POST | Navigate to default login URL programmatically |
| `/content/types` | GET | Query available content types for creation |
| `/content` | GET | Query existing content (limit, type filter, pagination) |

### Browser Status Response
```json
{
  "ready": true,
  "browser": true,
  "context": true,
  "page": true
}
```

## 🏗️ CRUD Operations

### Prerequisites
All CRUD operations require an authenticated admin session. Ensure you have:
1. **BASE_URL configured** in `.env` file (e.g., `BASE_URL=https://your-drupal-site.com`)
2. Started an interactive session: `POST /login/interactive`
3. Authenticated manually via VNC interface
4. Verified authentication: `GET /login/check` returns `{"authenticated": true, "adminAccess": true}`

### Content Type Discovery

**Query Available Content Types:**
```bash
curl http://localhost:3000/content/types
```

**Success Response (Admin Access):**
```json
{
  "success": true,
  "contentTypes": [
    {
      "name": "Article",
      "machineName": "article",
      "description": "Use articles for time-sensitive content like news, press releases or blog posts."
    },
    {
      "name": "Basic page",
      "machineName": "page",
      "description": "Use basic pages for your static content, such as an 'About us' page."
    }
  ],
  "count": 2,
  "source": "admin"
}
```

**Success Response (Content Creator Access):**
```json
{
  "success": true,
  "contentTypes": [
    {
      "name": "Accordion Item",
      "machineName": "ps_accordion_item",
      "description": "",
      "createUrl": "/node/add/ps_accordion_item"
    },
    {
      "name": "Alert",
      "machineName": "ps_alerts",
      "description": "",
      "createUrl": "/node/add/ps_alerts"
    },
    {
      "name": "Event",
      "machineName": "ps_events",
      "description": "",
      "createUrl": "/node/add/ps_events"
    }
  ],
  "count": 8,
  "source": "node_add"
}
```

**Discovery Strategy:**
1. **First Attempt**: Access `/admin/structure/types` (requires admin permissions)
2. **Fallback**: Access `/node/add` (requires content creation permissions)
3. **Result**: Returns available content types with creation URLs

This endpoint automatically discovers content types using the highest level of access available to the authenticated user.

### Content Query (Read)

**Query Existing Content:**
```bash
# Get latest 10 content items (page 1)
curl http://localhost:3000/content

# Get latest 5 news items from page 1
curl "http://localhost:3000/content?limit=5&type=news"

# Get page 2 of content (20 items per page)
curl "http://localhost:3000/content?limit=20&page=2"

# Get page 3 of event content
curl "http://localhost:3000/content?limit=10&type=event&page=3"
```

**Parameters:**
- `limit` (optional): Number of items to retrieve per page (1-100, default: 10)
- `type` (optional): Filter by content type (e.g., "news", "page", "event")
- `page` (optional): Page number to retrieve (1-based, default: 1)

### Content Detail Retrieval

**Get detailed content information by node ID:**

```bash
# Get detailed information for content node 123
curl http://localhost:3000/content/detail/123
```

**Response:**
```json
{
  "success": true,
  "content": {
    "nodeId": 123,
    "contentType": "article",
    "data": {
      "title": "Sample Article Title",
      "body": "<p>Detailed article content...</p>",
      "status": true,
      "author": "admin"
    },
    "interface": "edit",
    "extractedAt": "2025-01-07T12:00:00.000Z"
  },
  "schema": {
    "contentType": "article",
    "description": "Schema for Article content type",
    "fieldsUsed": ["title", "body", "status"]
  }
}
```

**Features:**
- **Edit Interface Priority**: Attempts edit interface first for full data access
- **Automatic Fallback**: Falls back to view interface if edit access is denied
- **Schema-Based Extraction**: Uses content type schemas for structured data extraction
- **Default Extraction**: Falls back to title/body extraction if no schema exists

### Schema System

**Content schemas define how to extract data from Drupal forms:**

```javascript
// schemas/article.json
{
  "contentType": "article",
  "fields": {
    "title": {
      "selector": "[name=\"title[0][value]\"]",
      "type": "text",
      "required": true
    },
    "body": {
      "selector": "[name=\"body[0][value]\"]",
      "type": "textarea"
    }
  }
}
```

**Schema files are automatically loaded from the `schemas/` directory based on content type.**

### Batch Processing with Pagination

The API provides comprehensive pagination information to enable efficient batch processing:

**Pagination Response Fields:**
- `currentPage`: Current page number (1-based)
- `hasNextPage`/`hasPrevPage`: Boolean flags for navigation
- `totalPages`: Total number of pages available (enables batch processing)
- `totalItems`: Total number of items across all pages (when available)
- `currentPageRange`: Text description of current page range (e.g., "1-50")

**Example: Efficient Batch Processing**
```javascript
// Get pagination info from first page
const response = await fetch('http://localhost:3000/content?page=1&limit=1');
const data = await response.json();

const totalPages = data.pagination.totalPages;
console.log(`Found ${totalPages} pages of content`);

// Fetch all pages efficiently
const allContent = [];
for (let page = 1; page <= totalPages; page++) {
  const pageResponse = await fetch(`http://localhost:3000/content?page=${page}&limit=50`);
  const pageData = await pageResponse.json();
  allContent.push(...pageData.content);
}

console.log(`Successfully fetched ${allContent.length} total items`);
```

### Example: Get latest Event then fetch its details

Below are two small examples (curl and Node.js) showing how to fetch the most recent event from the `/content` endpoint and then use the discovered `nodeId` to request detailed fields from `/content/detail/:id` (title, start/end times, location, category).

1) curl (shell)

```bash
# Fetch the latest event JSON
LIST_JSON=$(curl -s "http://localhost:3000/content?limit=1&type=event")

# Try extracting numeric id from `id` field, otherwise parse it out of `viewUrl` or `editUrl`
LATEST_NODE_ID=$(echo "$LIST_JSON" | jq -r '.content[0].id // empty')
if [ -z "$LATEST_NODE_ID" ]; then
  # fallback: extract from viewUrl (e.g. "/node/11831?...") or editUrl
  LATEST_NODE_ID=$(echo "$LIST_JSON" | jq -r '.content[0].viewUrl // .content[0].editUrl // empty' \
    | sed -E 's|.*/node/([0-9]+).*|\1|')
fi

if [ -z "$LATEST_NODE_ID" ]; then
  echo "Could not determine node id from response:" >&2
  echo "$LIST_JSON" | jq
  exit 1
fi

echo "Latest event node id: $LATEST_NODE_ID"

# Fetch event details
curl -s "http://localhost:3000/content/detail/$LATEST_NODE_ID" | jq
```

2) Node.js (node-fetch)

Create a small script `examples/get-latest-event.js` (or run inline). This version is defensive: it looks for `id` then falls back to parsing `viewUrl`/`editUrl` for `/node/<id>`.

```javascript
import fetch from 'node-fetch';

function extractIdFromItem(item = {}) {
  if (item.id) return String(item.id);
  const candidates = [item.viewUrl, item.editUrl];
  for (const s of candidates) {
    if (!s) continue;
    const m = s.match(/\/node\/(\d+)/);
    if (m) return m[1];
  }
  return null;
}

async function getLatestEventDetails() {
  const listRes = await fetch('http://localhost:3000/content?limit=1&type=event');
  const listJson = await listRes.json();

  if (!listJson || !Array.isArray(listJson.content) || listJson.content.length === 0) {
    console.log('No events found');
    return;
  }

  const item = listJson.content[0];
  const nodeId = extractIdFromItem(item);
  if (!nodeId) {
    console.error('Could not determine node id from item:', item);
    return;
  }

  console.log('Found latest event nodeId=', nodeId);

  const detailRes = await fetch(`http://localhost:3000/content/detail/${nodeId}`);
  const detailJson = await detailRes.json();

  if (!detailJson || !detailJson.success) {
    console.error('Failed to fetch detail for node', nodeId, detailJson);
    return;
  }

  // The detail payload places meaningful fields under `content.data` or similar.
  const content = detailJson.content || {};
  const data = content.data || {};

  // Try common keys but fall back gracefully
  const title = data.title || content.title || item.title || '(no title)';
  const start = data.start || data.start_time || data.date || null;
  const end = data.end || data.end_time || null;
  const location = data.location || data.venue || null;
  const category = data.category || data.type || content.contentType || item.type || null;

  console.log('Event details:');
  console.log('  title:', title);
  console.log('  start:', start);
  console.log('  end:  ', end);
  console.log('  location:', location);
  console.log('  category:', category);
}

getLatestEventDetails().catch(err => console.error(err));
```

Notes:
- The API list response sometimes uses `id` (as in your sample) or provides `viewUrl`/`editUrl` that include `/node/<id>`; the examples above attempt both strategies.
- Field names for event start/end and location may vary by site schema; the Node example attempts several common keys to be forgiving across sites.

**Real Example Output:**
```bash
=== Example: Fetch 75 Most Recent Items (Demonstration) ===
Site paginates by 50 items per page, so we need 2 pages

Step 1: Get pagination information from first page
API Call: GET /content?page=1&limit=1
Response: 46 total pages detected

Step 2: Calculate requirements
- Need 75 items total
- Site pages by 50 items per page
- Need to fetch 2 pages (100 items)
- Will trim results to exactly 75 items

Step 3: Fetch pages sequentially
API Call: GET /content?page=1&limit=50
Response: 50 items from page 1
API Call: GET /content?page=2&limit=50
Response: 50 items from page 2

Step 4: Aggregate and trim results
- Fetched 100 items from 2 pages
- Trimming to 75 items as requested

=== Results ===
Requested: 75 items
Fetched: 100 items from 2 pages
Returned: 75 items (trimmed to request)

=== Sample Content ===
1. Content Item 1 (Event) - Author 2
2. Content Item 2 (Event) - Author 3
...
```
*Demonstrates fetching 75 items across 2 pages (50 items each) with automatic aggregation and trimming*

### Practical Batch Processing Example

**Scenario**: Fetch 75 most recent items from a site that paginates by 50 items per page.

**Solution**: Use the included batch processor example:

```bash
# Install dependencies (includes node-fetch for the example)
npm install

# Run the batch processing example
node examples/batch-processor.js
```

**Example Output:**
```
=== Example: Fetch 75 Most Recent Items ===
Site paginates by 50 items per page, so we need 2 pages

Fetching: http://localhost:3000/content?page=1&limit=1
Site has 46 pages total
Need to fetch 2 pages to get 75 items
Fetching: http://localhost:3000/content?page=1&limit=50
Fetched page 1/2 (50 items)
Fetching: http://localhost:3000/content?page=2&limit=50
Fetched page 2/2 (25 items)

=== Results ===
Requested: 75 items
Fetched: 75 items from 2 pages
Returned: 75 items (trimmed to request)

=== Sample Content ===
1. Update this item (Event) - bino
2. Update this item (Course) - Anonymous
3. Update this item (Event) - ar8562
... and 72 more items
```

**Key Features of the Batch Processor:**
- **Automatic Page Calculation**: Determines how many pages to fetch
- **Concurrent Fetching**: Fetches multiple pages simultaneously for speed
- **Progress Tracking**: Shows progress during batch operations
- **Result Aggregation**: Combines and trims results to exact count requested
- **Error Handling**: Robust error handling for network issues

### Python Batch Processing Example

**Same functionality in Python** using the `requests` library:

```bash
# Create conda environment with required dependencies
conda env create -f environment.yml
conda activate drupal-ui-automation-examples

# Run the Python batch processing example
python3 examples/batch-processor.py
```

**Example Output:**
```
=== Example: Fetch 75 Most Recent Items (Demonstration) ===
Site paginates by 50 items per page, so we need 2 pages

Step 1: Get pagination information from first page
API Call: GET /content?page=1&limit=1
Response: 46 total pages detected

Step 2: Calculate requirements
- Need 75 items total
- Site pages by 50 items per page
- Need to fetch 2 pages (100 items)
- Will trim results to exactly 75 items

Step 3: Fetch pages sequentially
API Call: GET /content?page=1&limit=50
Response: 50 items from page 1
API Call: GET /content?page=2&limit=50
Response: 50 items from page 2

Step 4: Aggregate and trim results
- Fetched 100 items from 2 pages
- Trimming to 75 items as requested

=== Results ===
Requested: 75 items
Fetched: 100 items from 2 pages
Returned: 75 items (trimmed to request)

=== Sample Content ===
1. Content Item 1 (Event) - Author 2
2. Content Item 2 (Event) - Author 3
3. Content Item 3 (Event) - Author 4
4. Content Item 4 (Event) - Author 5
5. Content Item 5 (Event) - Author 1
... and 70 more items
```

**Python Implementation Features:**
- **Type Hints**: Full type annotations for better code clarity
- **Sequential Fetching**: Fetches pages one-by-one to avoid server overload
- **Exception Handling**: Comprehensive error handling with informative messages
- **Progress Callbacks**: Optional progress tracking during batch operations
- **Result Validation**: Validates API responses and handles malformed data

### Complete CRUD Workflow

1. **Authenticate** → Interactive login with admin access
2. **Discover** → Query available content types
3. **Create** → Create content of discovered types
4. **Read** → Query existing content
5. **Update** → Modify existing content
6. **Delete** → Remove content

## 🧪 Testing

### Run Tests in Container
```bash
# Run all tests in isolated container environment
npm run test:container

# Run only integration tests
npm run test:integration:container
```

### Test Architecture

**Containerized Testing**: Tests run in Docker containers, not on host system.

**Test Isolation**: Each test starts with clean browser state via cleanup endpoint.

**Testing Strategy**:
- **All Tests**: Run in containers for consistent environment and proper isolation
- **Unit Tests**: Component testing with mocks (e.g., mock API responder tests)
- **Integration Tests**: Full browser environment testing with real Playwright instances

**Mock API Responder**: Comprehensive mock implementation available for unit testing:

```javascript
const MockApiResponder = require('./tests/mock-api-responder');

describe('My API Tests', () => {
  let mockApi;

  beforeEach(() => {
    mockApi = new MockApiResponder({ simulateDelays: false });
  });

  afterEach(() => {
    mockApi.reset();
  });

  test('should test API endpoints', async () => {
    // Example: Test login flow
    await mockApi.request('POST', '/login/interactive');
    const response = await mockApi.request('GET', '/playwright/ready');
    expect(response.data.ready).toBe(true);
  });
});
```

**Running Tests**:
```bash
# Unit tests (fast, host system)
npm test

# Integration tests (full environment, container)
npm run test:integration:container

# All tests in container
npm run test:container
```

**Validation Points**:
- ✅ Browser launches only on explicit API calls
- ✅ No auto-navigation to DEFAULT_LOGIN_URL
- ✅ Manual navigation workflow preserved
- ✅ Proper containerization (no host processes)
- ✅ Clean test exits with `--forceExit`

## 🔧 Configuration

### Environment Variables (.env)

```bash
# Base URL of the Drupal site (required for all operations)
BASE_URL=https://example.com

# Default login URL (for reference only - not auto-navigated)
DEFAULT_LOGIN_URL=https://example.com/login

# Display settings
DISPLAY=:99
NOVNC_URL=http://localhost:8080/vnc.html

# Application settings
NODE_ENV=production
```

### Docker Services

- **drupal-ui-automation**: Main application server + browser automation
- **test**: Isolated testing environment (via `--profile test`)

## 🔍 Troubleshooting

### Browser Not Visible
```bash
# Check if browser processes are running
docker-compose exec drupal-ui-automation ps aux | grep chrome

# Trigger browser launch
curl -X POST -H "Content-Type: application/json" http://localhost:3000/login/interactive

# Access via VNC
open http://localhost:8080/vnc.html
```

### Tests Failing
```bash
# Run tests with verbose output
npm run test:container

# Check container logs
docker-compose logs drupal-ui-automation
```

### VNC Connection Issues
```bash
# Verify VNC services are running
docker-compose exec drupal-ui-automation ps aux | grep -E "(x11vnc|websockify)"

# Check VNC port accessibility
curl -I http://localhost:8080
```

## 📁 Project Structure

```
├── src/
│   ├── server.js              # Express API server
│   └── playwrightManager.js   # Browser lifecycle management
├── examples/
│   ├── batch-processor.js     # JavaScript client-side batch processing example
│   └── batch-processor.py     # Python client-side batch processing example
├── schemas/
│   ├── article.json           # Schema for article content type
│   └── event.json             # Schema for event content type
├── tests/
│   ├── integration/           # API integration tests
│   ├── unit/                  # Unit tests
│   └── mock-api-responder.js  # Mock API responder for testing
├── storage/                   # Persistent browser contexts
├── environment.yml            # Conda environment for Python examples
├── Dockerfile                 # Multi-stage container build
├── docker-compose.yml         # Local development orchestration
├── supervisord.conf          # Process management
└── .env                       # Environment configuration
```

## Development 

1. **Local Development**
   ```bash
   npm install
   npm run dev
   ```

2. **Testing**
   ```bash
   npm run test:container
   ```

3. **Container Development**
   ```bash
   docker-compose up --build
   ```

---

**Built with**: Node.js, Express, Playwright, Docker, Xvfb, VNC

**Purpose**: Interactive Drupal UI automation with session capture for programmatic workflows.
