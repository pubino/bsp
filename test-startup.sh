#!/bin/bash

# Start Xvfb in background
echo "Starting Xvfb..."
Xvfb :99 -screen 0 1280x720x24 -ac +extension GLX +render -noreset &
XVFB_PID=$!

# Wait for Xvfb to be ready
echo "Waiting for Xvfb to start..."
sleep 3

# Verify Xvfb is running
if kill -0 $XVFB_PID 2>/dev/null; then
    echo "Xvfb started successfully (PID: $XVFB_PID)"
else
    echo "Xvfb failed to start"
    exit 1
fi

# Set DISPLAY environment variable
export DISPLAY=:99

# Check if Playwright browsers are installed
echo "Checking Playwright browser installation..."
if npx playwright --version >/dev/null 2>&1; then
    echo "Playwright is available"
    if [ -d ~/.cache/ms-playwright ]; then
        echo "Playwright browsers directory exists"
        ls -la ~/.cache/ms-playwright/ 2>/dev/null || echo "Could not list browsers directory"
    else
        echo "Playwright browsers directory not found"
    fi
else
    echo "Playwright is not available"
fi

# Run the tests
echo "Starting tests..."
npm run test:all

# Cleanup
echo "Cleaning up Xvfb..."
kill $XVFB_PID 2>/dev/null || true