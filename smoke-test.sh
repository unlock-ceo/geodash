#!/usr/bin/env bash
# smoke-test.sh — verify the dev server starts and responds on the expected port
# Usage: ./smoke-test.sh [PORT]

set -euo pipefail

PORT="${1:-3000}"
URL="http://localhost:${PORT}"
TIMEOUT=30
PID=""

cleanup() {
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "Starting dev server on port ${PORT}..."
pnpm dev --port "$PORT" &
PID=$!

# Wait for the server to be ready
elapsed=0
while [ "$elapsed" -lt "$TIMEOUT" ]; do
  if curl -s -o /dev/null -w '' "$URL" 2>/dev/null; then
    echo "Server responded on ${URL}"
    # Check for HTTP 200
    STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$URL")
    if [ "$STATUS" = "200" ]; then
      echo "Smoke test passed — HTTP ${STATUS}"
      exit 0
    else
      echo "Smoke test failed — HTTP ${STATUS}"
      exit 1
    fi
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done

echo "Smoke test failed — server did not respond within ${TIMEOUT}s"
exit 1
