#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

OUT_FILE="docs/verification/artifacts/database-consistency-report.md"
mkdir -p "$(dirname "$OUT_FILE")"

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

check_path() {
  local path="$1"
  if [ -e "$path" ]; then
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
  echo "- **Repo root:** \`$ROOT_DIR\`"
  echo
  echo "## Runtime surface presence"
  echo
} > "$OUT_FILE"

for target in "${schema_targets[@]}"; do
  state="$(check_path "$target")"
  if [ "$state" = "missing" ]; then
    missing_count=$((missing_count + 1))
  fi
  echo "- \`$target\`: **$state**" >> "$OUT_FILE"
done

{
  echo
  echo "## Canonical truth expectations"
  echo
  echo "The following domains must eventually be backed by canonical SQLite schema + repository/service code:"
  echo
} >> "$OUT_FILE"

for target in "${truth_targets[@]}"; do
  echo "- $target" >> "$OUT_FILE"
done

{
  echo
  echo "## Current repo-state assessment"
  echo
} >> "$OUT_FILE"

if [ "$missing_count" -eq "${#schema_targets[@]}" ]; then
  {
    echo "- **Result:** BLOCKED"
    echo "- **Reason:** none of the expected DB/runtime surfaces exist yet in this worktree."
    echo "- **Interpretation:** canonical schema / migration / repository evidence cannot be proven until implementation lands."
  } >> "$OUT_FILE"
else
  {
    echo "- **Result:** PARTIAL"
    echo "- **Reason:** some runtime surfaces exist; this report should be regenerated after each schema/persistence change."
    echo
    echo "### Present paths"
    for target in "${schema_targets[@]}"; do
      if [ -e "$target" ]; then
        echo "- \`$target\`"
      fi
    done
  } >> "$OUT_FILE"
fi

echo >> "$OUT_FILE"
echo "## Next evidence to attach" >> "$OUT_FILE"
echo >> "$OUT_FILE"
echo "- migration output" >> "$OUT_FILE"
echo "- repository/service integration test output" >> "$OUT_FILE"
echo "- snapshot restore before/after proof" >> "$OUT_FILE"
echo "- import rollback proof" >> "$OUT_FILE"
echo "- token usage / generation archive samples" >> "$OUT_FILE"

echo "Wrote $OUT_FILE"
