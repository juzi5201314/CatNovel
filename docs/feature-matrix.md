# Feature Matrix — author-replica

> 说明：
>
> - 本矩阵是 `prd-author-replica` / `test-spec-author-replica` 的执行闸门。
> - 最终交付前，所有 capability 的 `Status` 必须收敛到：
>   - `implemented`
>   - `explicitly removed by requirement`
> - 当前文档允许使用执行态状态（如 `planned` / `in_progress`），用于并行 lane 协作。
> - 结构完整性可用 `scripts/verification/check-feature-matrix.sh` 验证。

## Workspace shell

### WS-01 — Unified workspace shell

- **Source evidence:** `../author/app/page.js:28-49`, `../author/README.zh.md:64-67`
- **Target owner:** Lane B — Design system & workspace shell
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#1-workspace-shell`

### WS-02 — Three-panel writing layout

- **Source evidence:** `../author/app/page.js:28-49`, `../author/app/page.js:180-220`
- **Target owner:** Lane B — Design system & workspace shell
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#1-workspace-shell`

### WS-03 — Sidebar collapse / expand

- **Source evidence:** `../author/app/page.js:28-49`
- **Target owner:** Lane B — Design system & workspace shell
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#1-workspace-shell`

### WS-04 — Help panel / shortcuts

- **Source evidence:** `../author/app/page.js:28-49`, `../author/README.zh.md:66-67`
- **Target owner:** Lane B / Phase 8
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#6-i18n--onboarding--help`

### WS-05 — Onboarding / tour overlay

- **Source evidence:** `../author/app/page.js:28-49`, `../author/README.zh.md:66-67`
- **Target owner:** Lane B / Phase 8
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#6-i18n--onboarding--help`

## Writing domain

### WD-01 — Work / volume / chapter management

- **Source evidence:** `../author/app/page.js:9-49`, `../author/app/store/useAppStore.js:27-109`
- **Target owner:** Lane C — Writing & settings domain
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#2-writing-domain`

### WD-02 — Autosave to canonical persistence

- **Source evidence:** `../author/app/lib/persistence.js:126-220`, `../author/app/lib/storage.js:98-165`
- **Target owner:** Lane A + Lane C
- **Status:** planned
- **Verification evidence:** `docs/verification/database-consistency.md#save--reload-proof`

### WD-03 — Chapter stats / reading metrics

- **Source evidence:** `../author/app/page.js:180-220`
- **Target owner:** Lane C — Writing & settings domain
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#2-writing-domain`

### WD-04 — Rich text editor / slash / bubble menu / highlight / page-break

- **Source evidence:** `../author/README.zh.md:40-67`, `DESIGN.md:63-145`, `prd-author-replica.md:316`
- **Target owner:** Lane C — Writing & settings domain
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#2-writing-domain`

## Webnovel settings system

### ST-01 — Tree-structured settings domain

- **Source evidence:** `../author/README.zh.md:49-53`, `../author/app/lib/settings.js:32-205`
- **Target owner:** Lane C — Writing & settings domain
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#3-webnovel-settings-system`

### ST-02 — Node CRUD for 角色 / 地点 / 物品 / 世界观 / 剧情 / 规则

- **Source evidence:** `../author/app/lib/settings.js:32-205`, `prd-author-replica.md:571-576`
- **Target owner:** Lane C — Writing & settings domain
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#3-webnovel-settings-system`

### ST-03 — Book info panel

- **Source evidence:** `../author/app/page.js:28-49`, `../author/app/lib/settings.js:32-205`
- **Target owner:** Lane C — Writing & settings domain
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#3-webnovel-settings-system`

### ST-04 — Settings injected into AI context

- **Source evidence:** `../author/README.zh.md:49-53`, `../author/app/lib/context-engine.js`, `prd-author-replica.md:596-602`
- **Target owner:** Lane D — AI platform
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#4-ai-platform`

## AI platform

### AI-01 — Provider profile CRUD

- **Source evidence:** `../author/README.zh.md:40-47`, `../author/app/api/ai/models/route.js:1-220`
- **Target owner:** Lane D — AI platform
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#4-ai-platform`

### AI-02 — Model discovery (OpenAI-compatible)

- **Source evidence:** `../author/app/api/ai/models/route.js:1-220`
- **Target owner:** Lane D — AI platform
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#4-ai-platform`

### AI-03 — Model discovery (Gemini-native)

- **Source evidence:** `../author/app/api/ai/models/route.js:1-120`
- **Target owner:** Lane D — AI platform
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#4-ai-platform`

### AI-04 — Model discovery (Claude-native)

- **Source evidence:** `../author/app/api/ai/models/route.js:18-34`
- **Target owner:** Lane D — AI platform
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#4-ai-platform`

### AI-05 — Custom endpoint support

- **Source evidence:** `../author/README.zh.md:40-47`, `../author/app/api/ai/models/route.js:1-220`
- **Target owner:** Lane D — AI platform
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#4-ai-platform`

### AI-06 — Streaming generation

- **Source evidence:** `../author/app/api/ai/route.js:1-220`
- **Target owner:** Lane D — AI platform
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#4-ai-platform`

### AI-07 — Inline generation tasks（续写 / 改写 / 润色 / 扩写）

- **Source evidence:** `../author/README.zh.md:40-47`, `prd-author-replica.md:596-602`
- **Target owner:** Lane D — AI platform
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#4-ai-platform`

### AI-08 — Ghost text accept / reject

- **Source evidence:** `../author/README.zh.md:40-47`
- **Target owner:** Lane D — AI platform
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#4-ai-platform`

### AI-09 — Free chat sessions

- **Source evidence:** `../author/README.zh.md:40-47`, `../author/app/store/useAppStore.js:27-109`
- **Target owner:** Lane D — AI platform
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#4-ai-platform`

### AI-10 — Context engine（chapter / settings / summaries / manual selection）

- **Source evidence:** `../author/README.zh.md:40-47`, `../author/app/api/ai/route.js:1-220`
- **Target owner:** Lane D — AI platform
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#4-ai-platform`

### AI-11 — Token usage archive

- **Source evidence:** `../author/app/page.js:9-49`, `prd-author-replica.md:596-602`
- **Target owner:** Lane D — AI platform
- **Status:** planned
- **Verification evidence:** `docs/verification/database-consistency.md#ai--archive-invariants`

## Import / export / snapshot

### IO-01 — Project JSON export

- **Source evidence:** `../author/app/lib/project-io.js:1-178`, `../author/README.zh.md:55-59`
- **Target owner:** Lane E — Import / export / snapshot
- **Status:** implemented
- **Verification evidence:** `docs/verification/artifacts/import-export-backup-proof.md#project-json-importexport`, `tests/project-transfer.test.ts`, `app/api/export/project/route.ts`

### IO-02 — Project JSON import

- **Source evidence:** `../author/app/lib/project-io.js:1-178`
- **Target owner:** Lane E — Import / export / snapshot
- **Status:** implemented
- **Verification evidence:** `docs/verification/artifacts/import-export-backup-proof.md#project-json-importexport`, `tests/project-transfer.test.ts`, `app/api/import/project/route.ts`

### IO-03 — TXT import

- **Source evidence:** `prd-author-replica.md:617-619`
- **Target owner:** Lane E — Import / export / snapshot
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#5-import--export--snapshot`

### IO-04 — MD import

- **Source evidence:** `prd-author-replica.md:617-619`
- **Target owner:** Lane E — Import / export / snapshot
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#5-import--export--snapshot`

### IO-05 — EPUB import

- **Source evidence:** `prd-author-replica.md:617-619`
- **Target owner:** Lane E — Import / export / snapshot
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#5-import--export--snapshot`

### IO-06 — DOCX import

- **Source evidence:** `prd-author-replica.md:617-619`
- **Target owner:** Lane E — Import / export / snapshot
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#5-import--export--snapshot`

### IO-07 — DOC import

- **Source evidence:** `../author/app/api/parse-file/route.js:1-55`, `prd-author-replica.md:617-619`
- **Target owner:** Lane E — Import / export / snapshot
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#5-import--export--snapshot`

### IO-08 — PDF import

- **Source evidence:** `../author/app/api/parse-file/route.js:1-55`, `prd-author-replica.md:617-619`
- **Target owner:** Lane E — Import / export / snapshot
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#5-import--export--snapshot`

### IO-09 — TXT export

- **Source evidence:** `prd-author-replica.md:619`, `../author/README.zh.md:55-59`
- **Target owner:** Lane E — Import / export / snapshot
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#5-import--export--snapshot`

### IO-10 — MD export

- **Source evidence:** `../author/app/page.js:9-17`, `../author/README.zh.md:55-59`
- **Target owner:** Lane E — Import / export / snapshot
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#5-import--export--snapshot`

### IO-11 — DOCX export

- **Source evidence:** `prd-author-replica.md:619`
- **Target owner:** Lane E — Import / export / snapshot
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#5-import--export--snapshot`

### IO-12 — EPUB export

- **Source evidence:** `prd-author-replica.md:619`
- **Target owner:** Lane E — Import / export / snapshot
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#5-import--export--snapshot`

### IO-13 — PDF export

- **Source evidence:** `prd-author-replica.md:619`, `../author/README.zh.md:55-59`
- **Target owner:** Lane E — Import / export / snapshot
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#5-import--export--snapshot`

### IO-14 — Immutable snapshot create / list / restore / delete

- **Source evidence:** `../author/app/page.js:9-17`, `../author/README.zh.md:55-59`
- **Target owner:** Lane E — Import / export / snapshot
- **Status:** implemented
- **Verification evidence:** `docs/verification/artifacts/import-export-backup-proof.md#snapshot-create-list-restore-delete`, `tests/snapshot-service.test.ts`, `app/api/snapshots/route.ts`

### IO-15 — Backup / restore / corruption recovery

- **Source evidence:** `prd-author-replica.md:620`, `prd-author-replica.md:649-650`
- **Target owner:** Lane E + Phase 9
- **Status:** implemented
- **Verification evidence:** `docs/verification/artifacts/import-export-backup-proof.md#backuprestorecorruption-recovery`, `tests/project-transfer.test.ts`, `scripts/backup-database.ts`, `scripts/restore-database.ts`, `scripts/recover-database.ts`

## Internationalization / support

### UX-01 — Locale coverage（zh / en / ru）

- **Source evidence:** `../author/README.zh.md:60-63`
- **Target owner:** Phase 8
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#6-i18n--onboarding--help`

### UX-02 — No untranslated core workspace strings

- **Source evidence:** `../author/README.zh.md:60-67`
- **Target owner:** Phase 8
- **Status:** planned
- **Verification evidence:** `docs/verification/manual-test-script.md#6-i18n--onboarding--help`

## Explicitly removed by requirement

### RM-01 — Theme switch / dark mode

- **Source evidence:** `../author/README.zh.md:64-67`, `../author/app/page.js:180-220`
- **Target owner:** global hard constraint
- **Status:** explicitly removed by requirement
- **Verification evidence:** `docs/verification/feature-gap-report.md#removed-items-absence-proof`, `docs/verification/artifacts/worker-1-removed-items-report.md`, `docs/verification/artifacts/worker-2-removed-items-report.md`, `scripts/verification/check-removed-items.sh`

### RM-02 — Layout mode switch

- **Source evidence:** `../author/README.zh.md:64-67`, `prd-author-replica.md:699-700`
- **Target owner:** global hard constraint
- **Status:** explicitly removed by requirement
- **Verification evidence:** `docs/verification/feature-gap-report.md#removed-items-absence-proof`, `docs/verification/artifacts/worker-1-removed-items-report.md`, `docs/verification/artifacts/worker-2-removed-items-report.md`, `scripts/verification/check-removed-items.sh`

### RM-03 — Cloud sync / account / login / register / collaboration

- **Source evidence:** `../author/app/page.js:28-49`, `../author/app/api/storage/route.js:1-214`
- **Target owner:** global hard constraint
- **Status:** explicitly removed by requirement
- **Verification evidence:** `docs/verification/feature-gap-report.md#removed-items-absence-proof`, `docs/verification/artifacts/worker-1-removed-items-report.md`, `docs/verification/artifacts/worker-2-removed-items-report.md`, `scripts/verification/check-removed-items.sh`

### RM-04 — Traditional mode / screenplay mode

- **Source evidence:** `../author/README.zh.md:49-53`
- **Target owner:** global hard constraint
- **Status:** explicitly removed by requirement
- **Verification evidence:** `docs/verification/feature-gap-report.md#removed-items-absence-proof`, `docs/verification/artifacts/worker-1-removed-items-report.md`, `docs/verification/artifacts/worker-2-removed-items-report.md`, `scripts/verification/check-removed-items.sh`

### RM-05 — Electron shell / updater / desktop packaging

- **Source evidence:** `../author/package.json:11-13`, `/home/soeur/project/author/electron/*`
- **Target owner:** global hard constraint
- **Status:** explicitly removed by requirement
- **Verification evidence:** `docs/verification/feature-gap-report.md#removed-items-absence-proof`, `docs/verification/artifacts/worker-1-removed-items-report.md`, `docs/verification/artifacts/worker-2-removed-items-report.md`, `scripts/verification/check-removed-items.sh`

## Current execution snapshot

- **Timestamp:** 2026-04-10
- **Observed repo state:** 当前仓库仅包含 `DESIGN.md` 与 `.omx/` 计划/状态文件，产品实现尚未落地。
- **Immediate consequence:** lane 级实现尚未开始，所有正向能力暂以 `planned` 标记；所有删项已先标记为 `explicitly removed by requirement`，后续必须由自动化扫描与人工 walkthrough 双重证明。
