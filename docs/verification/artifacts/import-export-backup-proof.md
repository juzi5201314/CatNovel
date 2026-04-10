# Import / Export / Backup Proof

- **Generated at:** 2026-04-10T13:50:00Z
- **Scope:** import / export / backup / restore / corruption-recovery lane

## Project JSON import/export

### Implemented paths

- `app/api/import/project/route.ts`
- `app/api/export/project/route.ts`
- `lib/server/project-transfer.ts`

### Proven behavior

- project archive export serializes canonical tables into `catnovel-project-json`
- project archive import restores canonical rows inside a transaction
- export route returns real project JSON when `format=json`

### Verification

- `pnpm test` → `✔ project archive export/import round-trips canonical rows`
- `pnpm typecheck` → pass
- `pnpm lint` → pass

## Backup/restore/corruption recovery

### Implemented paths

- `scripts/backup-database.ts`
- `scripts/restore-database.ts`
- `scripts/recover-database.ts`
- `lib/server/project-transfer.ts`

### Proven behavior

- backup creates a restorable SQLite copy plus manifest
- restore replays backup into the active database file and enforces integrity check
- corruption recovery restores from backup when the active DB fails integrity validation

### Verification

- `pnpm test` → `✔ backup / restore / corruption recovery scripts have working database primitives`
- `pnpm typecheck` → pass
- `pnpm lint` → pass

## Remaining lifecycle blockers

- `app/api/import/parse-file/route.ts` only proves format-surface parsing, not format-specific document extraction fidelity
- `app/api/export/chapters/route.ts` proves batch export wiring, but not full file serializer fidelity per format
- snapshot routes exist, but there is still no database-backed snapshot audit proof in the integrated branch
