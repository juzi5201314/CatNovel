# Database Consistency Report

- **Generated at:** 2026-04-10T14:48:55Z
- **Scanner root:** `/home/soeur/project/CatNovel`

## Runtime surface presence

- `db/schema.ts`: **present**
- `db/migrations`: **present**
- `db/client.ts`: **present**
- `lib/server/repositories`: **present**
- `app/api/bootstrap`: **present**
- `app/api/import`: **present**
- `app/api/export`: **present**
- `app/api/snapshots`: **present**

## Canonical truth expectations

The following domains must eventually be backed by canonical SQLite schema + repository/service code:

- works
- volumes
- chapters
- settings nodes
- snapshots
- chat sessions/messages
- context selections/summaries
- generation archive
- token usage
- import jobs
- export jobs
- preferences

## Current repo-state assessment

- **Result:** PARTIAL
- **Reason:** some runtime surfaces exist; this report should be regenerated after each schema/persistence change.

### Present paths
- `db/schema.ts`
- `db/migrations`
- `db/client.ts`
- `lib/server/repositories`
- `app/api/bootstrap`
- `app/api/import`
- `app/api/export`
- `app/api/snapshots`

## Next evidence to attach

- migration output
- repository/service integration test output
- snapshot restore before/after proof
- import rollback proof
- token usage / generation archive samples
