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
  OUT_FILE="docs/verification/artifacts/${report_slug}-database-consistency-report.md"
else
  OUT_FILE="docs/verification/artifacts/database-consistency-report.md"
fi
mkdir -p "$ROOT_DIR/$(dirname "$OUT_FILE")"

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

check_path() {
  local path="$1"
  if [ -e "$SCAN_ROOT/$path" ]; then
    echo "present"
  else
    echo "missing"
  fi
}

schema_targets=(
  "db/schema.ts"
  "db/migrations"
  "db/client.ts"
  "lib/server/repositories"
  "app/api/bootstrap"
  "app/api/import"
  "app/api/export"
  "app/api/snapshots"
)

truth_targets=(
  "works"
  "volumes"
  "chapters"
  "settings nodes"
  "snapshots"
  "chat sessions/messages"
  "context selections/summaries"
  "generation archive"
  "token usage"
  "import jobs"
  "export jobs"
  "preferences"
)

missing_count=0

{
  echo "# Database Consistency Report"
  echo
  echo "- **Generated at:** $timestamp"
  echo "- **Scanner root:** \`$SCAN_ROOT\`"
  if [ -n "$REPORT_LABEL" ]; then
    echo "- **Label:** \`$REPORT_LABEL\`"
  fi
  echo
  echo "## Runtime surface presence"
  echo
} > "$ROOT_DIR/$OUT_FILE"

for target in "${schema_targets[@]}"; do
  state="$(check_path "$target")"
  if [ "$state" = "missing" ]; then
    missing_count=$((missing_count + 1))
  fi
  echo "- \`$target\`: **$state**" >> "$ROOT_DIR/$OUT_FILE"
done

{
  echo
  echo "## Canonical truth expectations"
  echo
  echo "The following domains must eventually be backed by canonical SQLite schema + repository/service code:"
  echo
} >> "$ROOT_DIR/$OUT_FILE"

for target in "${truth_targets[@]}"; do
  echo "- $target" >> "$ROOT_DIR/$OUT_FILE"
done

{
  echo
  echo "## Current repo-state assessment"
  echo
} >> "$ROOT_DIR/$OUT_FILE"

if [ "$missing_count" -eq "${#schema_targets[@]}" ]; then
  {
    echo "- **Result:** BLOCKED"
    echo "- **Reason:** none of the expected DB/runtime surfaces exist yet in this worktree."
    echo "- **Interpretation:** canonical schema / migration / repository evidence cannot be proven until implementation lands."
  } >> "$ROOT_DIR/$OUT_FILE"
else
  {
    echo "- **Result:** PARTIAL"
    echo "- **Reason:** some runtime surfaces exist; this report should be regenerated after each schema/persistence change."
    echo
    echo "### Present paths"
    for target in "${schema_targets[@]}"; do
      if [ -e "$SCAN_ROOT/$target" ]; then
        echo "- \`$target\`"
      fi
    done
  } >> "$ROOT_DIR/$OUT_FILE"
fi

echo >> "$ROOT_DIR/$OUT_FILE"
echo "## Next evidence to attach" >> "$ROOT_DIR/$OUT_FILE"
echo >> "$ROOT_DIR/$OUT_FILE"
echo "- migration output" >> "$ROOT_DIR/$OUT_FILE"
echo "- repository/service integration test output" >> "$ROOT_DIR/$OUT_FILE"
echo "- snapshot restore before/after proof" >> "$ROOT_DIR/$OUT_FILE"
echo "- import rollback proof" >> "$ROOT_DIR/$OUT_FILE"
echo "- token usage / generation archive samples" >> "$ROOT_DIR/$OUT_FILE"

echo "Wrote $OUT_FILE"
