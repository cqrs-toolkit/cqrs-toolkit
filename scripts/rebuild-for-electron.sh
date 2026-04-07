#!/usr/bin/env bash
set -euo pipefail

# Rebuild better-sqlite3 for both system Node and Electron's Node ABI.
#
# The `bindings` package resolves native addons by searching ABI-specific
# directories under lib/binding/node-v{ABI}-{platform}-{arch}/. By placing
# a binary for each ABI there, both runtimes find their correct version
# without overwriting each other.
#
# Flow:
#   1. Copy the current system-Node-compiled binary to its ABI-specific dir
#   2. Run electron-rebuild to compile for Electron's ABI
#   3. Copy the Electron-compiled binary to its ABI-specific dir
#   4. Restore the system-Node binary to build/Release/ (so unit tests work)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BS3="$ROOT/node_modules/better-sqlite3"
BINDING="$BS3/lib/binding"
BUILD="$BS3/build/Release/better_sqlite3.node"

PLATFORM="$(node -p process.platform)"
ARCH="$(node -p process.arch)"

SYSTEM_ABI="node-v$(node -p process.versions.modules)-$PLATFORM-$ARCH"

# Read Electron's ABI from the abi_version file shipped in the electron package.
ELECTRON_MODULES="$(cat "$ROOT/node_modules/electron/abi_version")"
ELECTRON_ABI="node-v${ELECTRON_MODULES}-$PLATFORM-$ARCH"

echo "[rebuild] system ABI:   $SYSTEM_ABI"
echo "[rebuild] electron ABI: $ELECTRON_ABI"

if [ "$SYSTEM_ABI" = "$ELECTRON_ABI" ]; then
  echo "[rebuild] ABIs match — no dual build needed"
  exit 0
fi

# If both ABI-specific binaries already exist from a previous run, skip rebuild.
if [ -f "$BINDING/$SYSTEM_ABI/better_sqlite3.node" ] && [ -f "$BINDING/$ELECTRON_ABI/better_sqlite3.node" ]; then
  echo "[rebuild] both ABI binaries already present — skipping"
  exit 0
fi

# 1. Save the system-Node binary
if [ ! -f "$BUILD" ]; then
  echo "[rebuild] error: $BUILD not found — run 'npm rebuild better-sqlite3' first" >&2
  exit 1
fi
mkdir -p "$BINDING/$SYSTEM_ABI"
cp "$BUILD" "$BINDING/$SYSTEM_ABI/better_sqlite3.node"
echo "[rebuild] saved system binary → lib/binding/$SYSTEM_ABI/"

# 2. Rebuild for Electron
echo "[rebuild] rebuilding for Electron..."
npx electron-rebuild --root "$ROOT" --module-dir "$ROOT/demos/hypermedia-electron" -o better-sqlite3

# 3. Save the Electron binary
mkdir -p "$BINDING/$ELECTRON_ABI"
cp "$BUILD" "$BINDING/$ELECTRON_ABI/better_sqlite3.node"
echo "[rebuild] saved Electron binary → lib/binding/$ELECTRON_ABI/"

# 4. Remove the default binary so `bindings` falls through to
#    the ABI-specific lib/binding/ directories for both runtimes.
rm -f "$BUILD"
echo "[rebuild] removed build/Release/ default — bindings resolves via lib/binding/"

echo "[rebuild] done — both ABIs coexist"
