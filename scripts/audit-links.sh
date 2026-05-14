#!/bin/bash
# Audit markdown links in the castle.
# Walks every .md file under docs/, plus every CLAUDE.md (repo root, packages/<pkg>/, demos/<demo>/),
# and reports any link target that does not resolve to an existing file.
#
# Resolves both relative paths (relative to the linker's directory) and repo-absolute
# paths (starting with /, treated as relative to the repo root).
# Skips http(s)://, mailto:, tel: and pure #anchor links.
# Skips links inside fenced code blocks (``` fences, with optional leading whitespace) —
# those are example content, not real links from the surrounding doc.
#
# Exit code: 0 if all links resolve, 1 if any broken links were found.

set -uo pipefail

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "audit-links: not inside a git repo" >&2
  exit 2
}
cd "$repo_root"

files=$(
  {
    find docs -name "*.md" -type f 2>/dev/null
    [ -f CLAUDE.md ] && echo CLAUDE.md
    find packages demos -maxdepth 2 -name CLAUDE.md -type f 2>/dev/null
  } | sort -u
)

broken_count=0
out=$(
  for file in $files; do
    dir=$(dirname "$file")
    in_code=0
    while IFS= read -r line; do
      # Toggle in/out of fenced code block (allow leading whitespace for fences inside lists)
      if [[ "$line" =~ ^[[:space:]]*\`\`\` ]]; then
        in_code=$((1 - in_code))
        continue
      fi
      [ "$in_code" -eq 1 ] && continue
      echo "$line" | grep -oE '\[[^][]+\]\([^)[:space:]]+\)' | while read -r mdlink; do
        link=$(echo "$mdlink" | sed -E 's/\[[^]]+\]\(([^)]+)\)/\1/')
        case "$link" in
          http://*|https://*|mailto:*|tel:*) continue ;;
          \#*) continue ;;
        esac
        link_path="${link%#*}"
        [ -z "$link_path" ] && continue

        if [[ "$link_path" == /* ]]; then
          target="$repo_root$link_path"
        else
          target="$dir/$link_path"
        fi
        target_normalized=$(realpath -m --relative-to="$repo_root" "$target" 2>/dev/null) || continue
        if [ ! -e "$repo_root/$target_normalized" ]; then
          echo "BROKEN  in $file: $mdlink → $target_normalized"
        fi
      done
    done < "$file"
  done | sort -u
)

if [ -n "$out" ]; then
  echo "$out"
  broken_count=$(echo "$out" | wc -l)
  echo
  echo "audit-links: $broken_count broken link(s)"
  exit 1
fi

echo "audit-links: all links resolve"
exit 0
