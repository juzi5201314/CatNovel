#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCAN_ROOT="${SCAN_ROOT:-$ROOT_DIR}"
REPORT_LABEL="${REPORT_LABEL:-}"

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed 's#[^a-z0-9._-]#-#g'
}

if [ -n "$REPORT_LABEL" ]; then
  report_slug="$(slugify "$REPORT_LABEL")"
  OUT_FILE="docs/verification/artifacts/${report_slug}-removed-items-report.md"
else
  OUT_FILE="docs/verification/artifacts/removed-items-report.md"
fi
mkdir -p "$ROOT_DIR/$(dirname "$OUT_FILE")"

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

SEARCH_PATHS=()
cd "$SCAN_ROOT"
for path in app components lib db public package.json next.config.js next.config.mjs next.config.ts; do
  if [ -e "$path" ]; then
    SEARCH_PATHS+=("$path")
  fi
done

{
  echo "# Removed Items Report"
  echo
  echo "- **Generated at:** $timestamp"
  echo "- **Scanner root:** \`$SCAN_ROOT\`"
  if [ -n "$REPORT_LABEL" ]; then
    echo "- **Label:** \`$REPORT_LABEL\`"
  fi
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
} > "$ROOT_DIR/$OUT_FILE"

checks=(
  "Theme switch|next-themes|ThemeProvider|author-theme|themeMode|setTheme|darkMode"
  "Layout mode switch|layoutMode|overlayMode|pushMode"
  "Cloud sync / account / collaboration|firebase|CloudSyncIndicator|SyncGuideModal|AccountModal|LoginModal|RegisterModal|syncStatus|remoteCollaboration"
  "Traditional / screenplay mode|writingMode.*traditional|writingMode.*screenplay|traditionalFields|screenplayFields"
  "Electron / desktop updater|electron-updater|electron-builder|from ['\\\"]electron['\\\"]|require\\(['\\\"]electron['\\\"]\\)"
)

if [ "${#SEARCH_PATHS[@]}" -eq 0 ]; then
  for entry in "${checks[@]}"; do
    IFS='|' read -r name _ <<< "$entry"
    {
      echo "### $name"
      echo
      echo "- **Result:** SKIP"
      echo "- **Reason:** no product implementation paths exist yet under scanner root"
      echo
    } >> "$ROOT_DIR/$OUT_FILE"
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
    } >> "$ROOT_DIR/$OUT_FILE"
  else
    {
      echo "### $name"
      echo
      echo "- **Result:** PASS"
      echo "- **Matches:** none"
      echo
    } >> "$ROOT_DIR/$OUT_FILE"
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
} >> "$ROOT_DIR/$OUT_FILE"

echo "Wrote $OUT_FILE"
if [ "$overall_fail" -ne 0 ]; then
  exit 1
fi
