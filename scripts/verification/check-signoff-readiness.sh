#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FINAL_MODE="${1:-}"

if [ "$FINAL_MODE" = "--final" ]; then
  echo "INFO: running in FINAL mode; this is expected to fail until all feature-matrix statuses converge"
  echo
fi

require_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "FAIL: missing required artifact: $file"
    return 1
  fi
}

echo "== check required artifacts =="
required_files=(
  "docs/feature-matrix.md"
  "docs/verification/feature-gap-report.md"
  "docs/verification/manual-test-script.md"
  "docs/verification/database-consistency.md"
  "docs/verification/design-audit.md"
  "docs/verification/deployment-readiness.md"
  "docs/verification/signoff-checklist.md"
  "scripts/verification/check-feature-matrix.sh"
  "scripts/verification/check-removed-items.sh"
)

for file in "${required_files[@]}"; do
  require_file "$file"
done

echo "PASS: required artifacts exist"

echo
echo "== lint verification scripts =="
bash -n scripts/verification/check-feature-matrix.sh
bash -n scripts/verification/check-removed-items.sh
echo "PASS: verification scripts parse"

echo
echo "== validate feature matrix =="
if [ "$FINAL_MODE" = "--final" ]; then
  bash scripts/verification/check-feature-matrix.sh --final
else
  bash scripts/verification/check-feature-matrix.sh
fi

echo
echo "== check forbidden removed features =="
bash scripts/verification/check-removed-items.sh

echo
if [ "$FINAL_MODE" = "--final" ]; then
  echo "PASS: signoff readiness passed in FINAL mode"
else
  echo "PASS: signoff readiness passed in STRUCTURE mode"
fi
