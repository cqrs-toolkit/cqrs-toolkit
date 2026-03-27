#!/usr/bin/env bash
set -euo pipefail

# Cached docs-generation wrapper.
# Usage: ./scripts/docs-run.sh <package-dir> [deps...] -- <docs-command...>
#
# Hashes src/, typedoc.json, tsconfig configs, and upstream build hashes.
# Skips docs generation when the combined hash matches the stored value.
# On cache miss, runs the docs command then formats output with prettier.

CACHE_DIR="node_modules/.cache/docs-hashes"
BUILD_CACHE_DIR="node_modules/.cache/build-hashes"

# --- Parse arguments ---
PKG_DIR="$1"; shift
DEPS=()
while [[ $# -gt 0 && "$1" != "--" ]]; do
  DEPS+=("$1"); shift
done
if [[ "${1:-}" == "--" ]]; then shift; fi
DOCS_CMD=("$@")

PKG_NAME="$(basename "$PKG_DIR")"

# --- Compute hash input ---
HASH_INPUT=""

# Source files
if [[ -d "$PKG_DIR/src" ]]; then
  HASH_INPUT+="$(find "$PKG_DIR/src" -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum)"
fi

# Config files
for f in "$PKG_DIR/package.json" "$PKG_DIR/tsconfig.json" "$PKG_DIR/tsconfig.build.json" "$PKG_DIR/typedoc.json"; do
  if [[ -f "$f" ]]; then
    HASH_INPUT+="$(sha256sum "$f")"
  fi
done

# Upstream dependency build hashes — if an upstream package was rebuilt,
# its types may have changed and docs should regenerate.
for dep in "${DEPS[@]}"; do
  dep_hash_file="$BUILD_CACHE_DIR/$dep"
  if [[ -f "$dep_hash_file" ]]; then
    HASH_INPUT+="$(cat "$dep_hash_file")"
  else
    HASH_INPUT+="missing:$dep"
  fi
done

# --- Compute final hash ---
FINAL_HASH="$(printf '%s' "$HASH_INPUT" | sha256sum | cut -d' ' -f1)"

# --- Compare to stored hash ---
STORED_HASH_FILE="$CACHE_DIR/$PKG_NAME"
if [[ -f "$STORED_HASH_FILE" ]] && [[ "$(cat "$STORED_HASH_FILE")" == "$FINAL_HASH" ]]; then
  echo "[docs] $PKG_NAME — up to date, skipping"
  exit 0
fi

# --- Run docs ---
echo "[docs] $PKG_NAME — generating"
"${DOCS_CMD[@]}"

# --- Format generated docs ---
DOCS_DIR="$PKG_DIR/docs"
if [[ -d "$DOCS_DIR" ]]; then
  prettier --write --ignore-unknown "$DOCS_DIR/**/*.md" 2>/dev/null || true
fi

# --- Store hash and mark for staging ---
mkdir -p "$CACHE_DIR"
echo "$DOCS_DIR" >> "$CACHE_DIR/docs-staged"
printf '%s' "$FINAL_HASH" > "$STORED_HASH_FILE"
