#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

SEARCH_PATHS=()
for path in app components lib db tests public package.json pnpm-lock.yaml next.config.js next.config.mjs next.config.ts; do
  if [ -e "$path" ]; then
    SEARCH_PATHS+=("$path")
  fi
done

if [ "${#SEARCH_PATHS[@]}" -eq 0 ]; then
  echo "SKIP: no product paths found yet"
  exit 0
fi

declare -a CHECKS=(
  "theme|dark mode|light mode"
  "layout mode|overlay mode|push mode"
  "cloud sync|sync guide|remote collaboration"
  "login|register|account modal|account state"
  "traditional mode|screenplay mode"
  "electron|electron-builder|electron-updater|desktop updater"
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

echo "PASS: forbidden feature markers not found in product paths"
