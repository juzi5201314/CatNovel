# Feature Gap Report — author-replica

## Current snapshot

- **Date:** 2026-04-10
- **Scope:** 仓库当前交付物、`docs/feature-matrix.md`、PRD / Test Spec、source evidence
- **Conclusion:** 当前是 **execution bootstrap** 阶段。功能矩阵已建立，但实现仓尚未出现实际 App / DB / route / component 代码，因此除删项外的全部 capability 仍待实现与验证。

## Removed items absence proof

以下能力必须证明 **不存在**：

1. theme switch / dark mode toggle
2. layout mode switch
3. cloud sync / account / login / register / remote collaboration
4. traditional mode
5. screenplay mode
6. electron shell / updater / desktop packaging

### Automated proof

- 扫描脚本：`scripts/verification/check-removed-items.sh`
- 扫描范围：`app/`, `components/`, `lib/`, `db/`, `tests/`, `public/`, `package.json`, `next.config.*`
- 排除范围：`.omx/`, `docs/verification/`, `docs/feature-matrix.md`, `AGENTS.md`, `DESIGN.md`

### Manual proof

- 按 `docs/verification/manual-test-script.md#1-workspace-shell`
- 明确确认：
  - UI 中无主题切换入口
  - UI 中无布局模式切换入口
  - UI 中无登录/注册/同步/账户入口
  - UI 中无传统文学 / 剧本模式切换
  - 仓库中无 Electron / updater 产物

## Positive gaps by domain

### Workspace shell

- **Gap:** 尚无统一工作台实现
- **Needed evidence:** shell render、三栏布局、侧栏伸缩、右侧 AI 面板

### Writing domain

- **Gap:** 尚无作品 / 分卷 / 章节 / 编辑器 / 自动保存
- **Needed evidence:** 编辑回写 SQLite、刷新恢复、章节统计

### Settings system

- **Gap:** 尚无 webnovel taxonomy 与设定树
- **Needed evidence:** 节点 CRUD、类型字段验证、规则注入 AI

### AI platform

- **Gap:** 尚无 provider registry / model discovery / streaming / ghost text / token archive
- **Needed evidence:** happy path 与 degraded path 的 route / transcript / archive

### Import / export / snapshot

- **Gap:** 尚无 import/export parser、serializer、snapshot 审计流
- **Needed evidence:** round-trip、checksum、snapshot restore、corruption recovery

### I18n / support

- **Gap:** 尚无 zh/en/ru 文案、引导、帮助面板
- **Needed evidence:** 三语言 walkthrough、缺失 key 报告

### Ops readiness

- **Gap:** 尚无 bootstrap / migration / backup / restore / health
- **Needed evidence:** `deployment-readiness.md` 里的演练结果

## Update rules

每次 lane 收尾时，必须至少更新以下内容：

1. `docs/feature-matrix.md` 中对应 capability 的 `Status`
2. 对应 capability 的 `Verification evidence`
3. 本文件中的 gap 状态
4. 若完成删项 absence proof，需要补充自动化命令输出位置
