#!/usr/bin/env bash
set -euo pipefail

# Stage generated docs directories listed in the docs-staged manifest.
# Consumes and removes the manifest. No-op if the manifest does not exist.

STAGED_FILE="node_modules/.cache/docs-hashes/docs-staged"

if [[ ! -f "$STAGED_FILE" ]]; then
  exit 0
fi

while IFS= read -r dir; do
  git add "$dir"
done < "$STAGED_FILE"

rm "$STAGED_FILE"
