#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

OUT_FILE="docs/verification/artifacts/removed-items-report.md"
mkdir -p "$(dirname "$OUT_FILE")"

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

SEARCH_PATHS=()
for path in app components lib db tests public package.json pnpm-lock.yaml next.config.js next.config.mjs next.config.ts; do
  if [ -e "$path" ]; then
    SEARCH_PATHS+=("$path")
  fi
done

{
  echo "# Removed Items Report"
  echo
  echo "- **Generated at:** $timestamp"
  echo "- **Repo root:** \`$ROOT_DIR\`"
  echo
  echo "## Scope"
  echo
  if [ "${#SEARCH_PATHS[@]}" -eq 0 ]; then
    echo "- No product implementation paths exist yet."
    echo "- Current evidence status: **blocked by missing runtime surfaces**."
  else
    echo "- Searched paths:"
    for path in "${SEARCH_PATHS[@]}"; do
      echo "  - \`$path\`"
    done
  fi
  echo
  echo "## Checks"
  echo
} > "$OUT_FILE"

checks=(
  "Theme switch|theme|dark mode|light mode"
  "Layout mode switch|layout mode|overlay mode|push mode"
  "Cloud sync / account / collaboration|cloud sync|sync guide|remote collaboration|login|register|account modal|account state"
  "Traditional / screenplay mode|traditional mode|screenplay mode"
  "Electron / desktop updater|electron|electron-builder|electron-updater|desktop updater"
)

if [ "${#SEARCH_PATHS[@]}" -eq 0 ]; then
  for entry in "${checks[@]}"; do
    IFS='|' read -r name _ <<< "$entry"
    {
      echo "### $name"
      echo
      echo "- **Result:** SKIP"
      echo "- **Reason:** no product implementation paths exist yet"
      echo
    } >> "$OUT_FILE"
  done
  echo "Wrote $OUT_FILE"
  exit 0
fi

overall_fail=0
for entry in "${checks[@]}"; do
  IFS='|' read -r name pattern1 rest <<< "$entry"
  pattern="$pattern1"
  if [ -n "${rest:-}" ]; then
    pattern="$pattern1|$rest"
  fi

  if matches="$(rg -n -i --glob '!docs/**' --glob '!.omx/**' --glob '!AGENTS.md' --glob '!DESIGN.md' "$pattern" "${SEARCH_PATHS[@]}" || true)"; then
    :
  fi

  if [ -n "$matches" ]; then
    overall_fail=1
    {
      echo "### $name"
      echo
      echo "- **Result:** FAIL"
      echo "- **Matches:**"
      echo
      echo '```text'
      echo "$matches"
      echo '```'
      echo
    } >> "$OUT_FILE"
  else
    {
      echo "### $name"
      echo
      echo "- **Result:** PASS"
      echo "- **Matches:** none"
      echo
    } >> "$OUT_FILE"
  fi
done

{
  echo "## Summary"
  echo
  if [ "$overall_fail" -eq 0 ]; then
    echo "- Overall result: **PASS**"
  else
    echo "- Overall result: **FAIL**"
  fi
} >> "$OUT_FILE"

echo "Wrote $OUT_FILE"
if [ "$overall_fail" -ne 0 ]; then
  exit 1
fi
