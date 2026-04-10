#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCAN_ROOT="${SCAN_ROOT:-$ROOT_DIR}"
cd "$SCAN_ROOT"

SEARCH_PATHS=()
for path in app components lib db public package.json next.config.js next.config.mjs next.config.ts; do
  if [ -e "$path" ]; then
    SEARCH_PATHS+=("$path")
  fi
done

if [ "${#SEARCH_PATHS[@]}" -eq 0 ]; then
  echo "SKIP: no product paths found yet"
  exit 0
fi

declare -a CHECKS=(
  "next-themes|ThemeProvider|author-theme|themeMode|setTheme|darkMode"
  "layoutMode|overlayMode|pushMode"
  "firebase|CloudSyncIndicator|SyncGuideModal|AccountModal|LoginModal|RegisterModal|syncStatus|remoteCollaboration"
  "writingMode.*traditional|writingMode.*screenplay|traditionalFields|screenplayFields"
  "electron-updater|electron-builder|from ['\\\"]electron['\\\"]|require\\(['\\\"]electron['\\\"]\\)"
)

found=0
for pattern in "${CHECKS[@]}"; do
  if rg -n -i --glob '!docs/**' --glob '!.omx/**' --glob '!AGENTS.md' --glob '!DESIGN.md' "$pattern" "${SEARCH_PATHS[@]}"; then
    found=1
  fi
done

if [ "$found" -ne 0 ]; then
  echo "FAIL: forbidden feature markers detected"
  exit 1
fi

echo "PASS: forbidden feature markers not found in product paths under $SCAN_ROOT"
