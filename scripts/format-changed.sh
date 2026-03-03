#!/usr/bin/env bash
set -euo pipefail

# All tracked files that differ from the last commit on this branch
git diff -z --name-only --diff-filter=ACMR HEAD \
  | xargs -0 prettier --write --ignore-unknown
