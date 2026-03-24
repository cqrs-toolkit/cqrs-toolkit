#!/usr/bin/env bash
set -euo pipefail

# Default build-cache wrapper.
# Usage: ./scripts/cache-run.sh <package-dir> [deps...] -- <build-command...>
#
# Hashes src/, package.json, tsconfig.json, and upstream dep hashes.
# Skips the build command when the combined hash matches the stored value.

CACHE_DIR="node_modules/.cache/build-hashes"

# --- Parse arguments ---
PKG_DIR="$1"; shift
DEPS=()
while [[ $# -gt 0 && "$1" != "--" ]]; do
  DEPS+=("$1"); shift
done
if [[ "${1:-}" == "--" ]]; then shift; fi
BUILD_CMD=("$@")

PKG_NAME="$(basename "$PKG_DIR")"

# --- Compute hash input ---
HASH_INPUT=""

# Source files
if [[ -d "$PKG_DIR/src" ]]; then
  HASH_INPUT+="$(find "$PKG_DIR/src" -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum)"
fi

# Config files
for f in "$PKG_DIR/package.json" "$PKG_DIR/tsconfig.json"; do
  if [[ -f "$f" ]]; then
    HASH_INPUT+="$(sha256sum "$f")"
  fi
done

# Upstream dependency hashes
for dep in "${DEPS[@]}"; do
  dep_hash_file="$CACHE_DIR/$dep"
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
  echo "[cache] $PKG_NAME — up to date, skipping build"
  exit 0
fi

# --- Run build ---
echo "[cache] $PKG_NAME — building"
"${BUILD_CMD[@]}"

# --- Store hash on success ---
mkdir -p "$CACHE_DIR"
printf '%s' "$FINAL_HASH" > "$STORED_HASH_FILE"
