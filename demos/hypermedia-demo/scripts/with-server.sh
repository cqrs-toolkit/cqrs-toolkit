#!/usr/bin/env bash
set -euo pipefail

# Start the hypermedia-demo server, wait for it to be ready,
# run the provided command, then shut down the server.
#
# Usage: ./scripts/with-server.sh <command...>
# Example: ./scripts/with-server.sh npm run cqrs-generate -w @cqrs-toolkit/hypermedia-demo

HEALTH_URL="http://localhost:3002/api/meta/apidoc"
MAX_WAIT=30

if [ $# -eq 0 ]; then
  echo "Usage: $0 <command...>"
  exit 1
fi

SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    echo "[with-server] shutting down server (pgid $SERVER_PID)..."
    kill -- -"$SERVER_PID" 2>/dev/null || kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Start server in its own process group so cleanup kills the entire tree
echo "[with-server] starting server..."
set -m
npx tsx demos/hypermedia-demo/server/server.ts &
SERVER_PID=$!
set +m

# Wait for server to be ready
echo "[with-server] waiting for server at $HEALTH_URL..."
elapsed=0
while ! curl -sf "$HEALTH_URL" > /dev/null 2>&1; do
  if [ $elapsed -ge $MAX_WAIT ]; then
    echo "[with-server] server did not become ready within ${MAX_WAIT}s"
    exit 1
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done
echo "[with-server] server ready (${elapsed}s)"

# Run the command
echo "[with-server] running: $*"
"$@"
