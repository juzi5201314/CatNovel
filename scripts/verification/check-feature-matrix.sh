#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

MATRIX_FILE="docs/feature-matrix.md"
FINAL_ONLY="${1:-}"

if [ ! -f "$MATRIX_FILE" ]; then
  echo "FAIL: $MATRIX_FILE not found"
  exit 1
fi

awk -v final_mode="$FINAL_ONLY" '
function trim(value) {
  gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
  return value
}

function reset_section() {
  source_seen = 0
  owner_seen = 0
  status_seen = 0
  verification_seen = 0
  status_value = ""
}

function validate_section() {
  if (section_name == "") return

  if (!source_seen) {
    printf("FAIL: %s missing Source evidence\n", section_name)
    failed = 1
  }
  if (!owner_seen) {
    printf("FAIL: %s missing Target owner\n", section_name)
    failed = 1
  }
  if (!status_seen) {
    printf("FAIL: %s missing Status\n", section_name)
    failed = 1
  }
  if (!verification_seen) {
    printf("FAIL: %s missing Verification evidence\n", section_name)
    failed = 1
  }

  if (final_mode == "--final" && status_seen) {
    if (status_value != "implemented" && status_value != "explicitly removed by requirement") {
      printf("FAIL: %s has non-final status: %s\n", section_name, status_value)
      failed = 1
    }
  }
}

BEGIN {
  failed = 0
  section_name = ""
  reset_section()
}

/^### / {
  validate_section()
  section_name = substr($0, 5)
  reset_section()
  next
}

section_name != "" {
  if ($0 ~ /^- \*\*Source evidence:\*\*/) source_seen = 1
  if ($0 ~ /^- \*\*Target owner:\*\*/) owner_seen = 1
  if ($0 ~ /^- \*\*Status:\*\*/) {
    status_seen = 1
    status_value = trim(substr($0, index($0, ":") + 1))
  }
  if ($0 ~ /^- \*\*Verification evidence:\*\*/) verification_seen = 1
}

END {
  validate_section()
  if (failed) exit 1
  print "PASS: feature matrix sections are structurally complete"
}
' "$MATRIX_FILE"
