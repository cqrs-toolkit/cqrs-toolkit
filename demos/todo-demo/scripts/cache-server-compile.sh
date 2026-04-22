#!/usr/bin/env bash
set -euo pipefail

# Cache wrapper for the todo-demo server-side tsc check.
#
# This compile does not fit cache-run.sh's default template
# (PKG_DIR/src + PKG_DIR/package.json + PKG_DIR/tsconfig.json) because
# it lives under server/ and tests/ and uses tsconfig.server.json.
#
# Inputs hashed:
#   - server/        (recursively)
#   - tests/         (recursively)
#   - tsconfig.server.json
#   - package.json
#   - upstream build hash for `client`
#
# Stores its hash under build-hashes/todo-demo-server so the standard
# clean-cache target picks it up.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PKG_DIR/../.." && pwd)"

CACHE_KEY="todo-demo-server"
CACHE_DIR="$REPO_ROOT/node_modules/.cache/build-hashes"
STORED_HASH_FILE="$CACHE_DIR/$CACHE_KEY"

HASH_INPUT=""

for dir in "$PKG_DIR/server" "$PKG_DIR/tests"; do
  HASH_INPUT+="$(find "$dir" -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum)"
done

for f in "$PKG_DIR/tsconfig.server.json" "$PKG_DIR/package.json"; do
  HASH_INPUT+="$(sha256sum "$f")"
done

for dep in client; do
  dep_hash_file="$CACHE_DIR/$dep"
  if [[ -f "$dep_hash_file" ]]; then
    HASH_INPUT+="$(cat "$dep_hash_file")"
  else
    HASH_INPUT+="missing:$dep"
  fi
done

FINAL_HASH="$(printf '%s' "$HASH_INPUT" | sha256sum | cut -d' ' -f1)"

if [[ -f "$STORED_HASH_FILE" ]] && [[ "$(cat "$STORED_HASH_FILE")" == "$FINAL_HASH" ]]; then
  echo "[build] $CACHE_KEY — up to date, skipping"
  exit 0
fi

echo "[build] $CACHE_KEY — running"
cd "$REPO_ROOT"
npx tsc -p demos/todo-demo/tsconfig.server.json --noEmit

mkdir -p "$CACHE_DIR"
printf '%s' "$FINAL_HASH" > "$STORED_HASH_FILE"
