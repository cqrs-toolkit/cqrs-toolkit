#!/usr/bin/env bash
set -euo pipefail

# Wipe all dist/ directories and node_modules so the next `npm install`
# starts from a clean slate (including native module rebuilds).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "[clean] removing dist/ directories..."
find "$ROOT/packages" "$ROOT/demos" -name dist -type d -prune -exec rm -rf {} +

echo "[clean] removing node_modules/..."
rm -rf "$ROOT/node_modules"

echo "[clean] removing build caches..."
rm -rf "$ROOT/node_modules/.cache/build-hashes" \
       "$ROOT/node_modules/.cache/compile-hashes" \
       "$ROOT/node_modules/.cache/docs-hashes"

echo "[clean] done — run 'npm install' to reinstall"
