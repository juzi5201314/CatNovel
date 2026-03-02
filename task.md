# CatNovel 任务清单（由 `plan.md` 拆解）

更新时间：2026-03-02

## 执行规则

- [ ] 并行块之间可并行执行；同一并行块内任务必须按序串行执行（1 -> N）。
- [ ] 每完成一个原子子任务，勾选对应子任务复选框。
- [ ] 一个并行块全部完成后，勾选该并行块标题。
- [ ] 后续波次必须等待其依赖波次全部完成后再启动。

## 依赖关系（波次级）

1. `W0 -> W1 -> W2 -> W3 -> W4 -> W5 -> W7`
2. `W4 -> W6(可选) -> W7`
3. `W3` 依赖 `W2` 与 `W1-B/W1-C`
4. `W5` 依赖 `W4` 与 `W3-E`

---

## W0 启动波次（必须串行）

- [x] **并行块 W0-S：工程初始化（前置：无）**
  1. [x] 使用 `pnpm` 初始化 Next.js App Router 工程（Node runtime）。
  2. [x] 安装核心依赖：Mastra、Drizzle、SQLite 驱动、LanceDB、Zustand、TipTap、Geist。
  3. [x] 按 `plan.md` 创建基础目录骨架（`app/api`、`mastra`、`core`、`repositories`、`db` 等）。
  4. [x] 提交一次可启动的最小骨架验证（本地启动成功）。

---

## W1 基础设施冻结波次（可并行，依赖 W0）

- [x] **并行块 W1-A：数据库基础与迁移入口（前置：W0-S）**
  1. [x] 建立 Drizzle 配置与 SQLite 连接工厂。
  2. [x] 创建基础业务表（项目、章节）与首个 migration。
  3. [x] 实现 repository 基类与事务边界封装。
  4. [x] 验证 migration 可重复执行且查询正常。

- [x] **并行块 W1-B：LLM Provider/Preset/Secret 模型（前置：W0-S）**
  1. [x] 创建 `llm_providers`、`llm_model_presets`、`llm_default_selection` 表。
  2. [x] 创建 `secret_store` 表（含 `key_version` 字段）。
  3. [x] 实现 `AES-256-GCM` 加解密服务（主密钥来自 `CATNOVEL_SECRET_KEY`）。
  4. [x] 实现 API Key 入库加密、读取解密与 key version 轮换逻辑。
  5. [x] 写入内置 Provider/Preset seed（含 DeepSeek 默认 `baseURL`）。

- [x] **并行块 W1-C：Tool 审批与审计模型（前置：W0-S）**
  1. [x] 创建 `tool_policies`、`tool_approval_requests`、`tool_execution_logs` 表。
  2. [x] 实现审批状态机（`pending -> approved/rejected -> executed/expired`）。
  3. [x] 实现审批与执行日志 repository。
  4. [x] 写入内置风险分级策略 seed（`read/write/high_risk`）。

- [x] **并行块 W1-D：LanceDB 最小能力（前置：W0-S）**
  1. [x] 建立 LanceDB 客户端与集合初始化逻辑。
  2. [x] 定义 chunk 元数据 schema（`project_id/chapter_no/chunk_id/...`）。
  3. [x] 实现向量 `upsert/query/delete` 封装。
  4. [x] 完成最小读写联通验证（写入一条并可召回）。

- [x] **并行块 W1-E：前端视觉基线（前置：W0-S）**
  1. [x] 接入 Geist Sans / Geist Mono。
  2. [x] 建立基础设计 token（颜色、间距、字号、边框半径）。
  3. [x] 搭建三栏布局基础壳（仅占位）。
  4. [x] 验证桌面与移动端可正常加载。

---

## W2 编辑器与项目骨架波次（可并行，依赖 W1-A + W1-E）

- [x] **并行块 W2-A：项目与章节 API（前置：W1-A）**
  1. [x] 实现 `GET/POST /api/projects`。
  2. [x] 实现 `GET/POST /api/projects/:projectId/chapters`。
  3. [x] 实现 `PATCH /api/chapters/:chapterId`。
  4. [x] 加入请求校验与统一错误响应结构。
  5. [x] 覆盖“新建作品 -> 新建章节 -> 编辑保存”最小链路测试。

- [x] **并行块 W2-B：工作台三栏与导航（前置：W1-E）**
  1. [x] 完成三栏布局与基础路由结构。
  2. [x] 实现项目列表与章节列表视图。
  3. [x] 实现创建项目/章节交互与状态反馈。
  4. [x] 接入 Zustand 管理工作台状态。

- [x] **并行块 W2-C：TipTap 编辑体验（前置：W1-E）**
  1. [x] 集成 TipTap 基础扩展与最小工具条。
  2. [x] 实现字数统计栏与保存状态提示。
  3. [x] 接入快捷键（保存/基础编辑命令）。
  4. [x] 与章节 API 打通自动保存/手动保存。

---

## W3 AI 生成与设置中心波次（可并行，依赖 W2 + W1-B + W1-C）

- [x] **并行块 W3-A：AI 流式接口（前置：W2-A, W1-B）**
  1. [x] 实现 `POST /api/ai/chat`（SSE，输出 `token/tool_call/context_used/done`）。
  2. [x] 实现 `POST /api/ai/generate`（续写/改写/润色/扩写）。
  3. [x] 接入 preset 与 `override.apiFormat`（`chat_completions/responses`）。
  4. [x] 实现可中断生成（AbortSignal/任务句柄）。

- [x] **并行块 W3-B：Ghost Text 与 AI 侧栏 UI（前置：W2-B, W2-C, W3-A）**
  1. [x] 实现 AI 侧栏对话面板与消息流渲染。
  2. [x] 实现流式中断、重试、错误反馈。
  3. [x] 实现 Ghost Text 接受/拒绝/重生成。
  4. [x] 打通编辑器回填与插入光标行为。

- [x] **并行块 W3-C：供应商与模型预设 API（前置：W1-B）**
  1. [x] 实现 `providers` CRUD（内置项删除限制与字段限制）。
  2. [x] 实现 `model-presets` CRUD。
  3. [x] 实现 `PATCH /api/settings/llm-defaults`。
  4. [x] 实现 `POST /api/settings/providers/:id/rotate-key`。
  5. [x] 覆盖协议、用途、预算字段校验测试。

- [x] **并行块 W3-D：设置页 UI（前置：W3-C, W2-B）**
  1. [x] 实现 Provider 列表、编辑、启停与新增。
  2. [x] 实现 Model Preset 列表、编辑、删除与新增。
  3. [x] 实现项目级默认 Chat/Embedding 预设选择。
  4. [x] 展示密钥状态并支持 rotate key 操作。
  5. [x] 验证 API 格式切换后可成功调用对应供应商。

- [x] **并行块 W3-E：Tool 执行与审批流 API+UI（前置：W1-C, W2-B）**
  1. [x] 实现 `POST /api/tools/execute`（读直执行、写/高风险转审批）。
  2. [x] 实现审批接口（列表/详情/approve/reject/stream）。
  3. [x] 实现审批中心 UI 与实时通知订阅。
  4. [x] 审批通过后执行工具并写入执行日志。
  5. [x] 完成风险级别回归测试矩阵（`read/write/high_risk`）。

---

## W4 RAG 全文索引波次（可并行，依赖 W3-A + W1-D + W2-A）

- [x] **并行块 W4-A：Chunk 与索引构建管线（前置：W1-D, W2-A, W3-C）**
  1. [x] 实现双粒度切块（细粒度 300~500 tokens + 粗粒度摘要块）。
  2. [x] 实现全章节 chunk 入库与 embedding upsert。
  3. [x] 落实必需元数据字段（`project_id/chapter_no/chunk_id/chunk_type/...`）。
  4. [x] 实现章节更新后的增量重建与删除同步。

- [x] **并行块 W4-B：混合检索编排（前置：W4-A）**
  1. [x] 实现查询意图分类（事实/关系/创作）。
  2. [x] 实现元数据过滤 + 向量 Top-K 召回。
  3. [x] 实现实体别名精确匹配补召回。
  4. [x] 实现重排（语义相关性 + 时间一致性 + 章节距离）。
  5. [x] 实现上下文组装优先级策略。

- [x] **并行块 W4-C：RAG API 契约（前置：W4-B）**
  1. [x] 实现 `POST /api/rag/query`（返回 `hits/events/usedGraphRag`）。
  2. [x] 实现 `POST /api/rag/reindex`（任务排队与状态）。
  3. [x] 实现 `POST /api/rag/embed` 与 `GET /api/rag/index-status`。
  4. [x] 为前端共享 TypeScript 契约定义统一类型。

- [x] **并行块 W4-D：RAG 指标评估（前置：W4-C）**
  1. [x] 构建跨章节召回评测样例集。
  2. [x] 实现 `Recall@K` 与 `Evidence Precision` 统计脚本。
  3. [x] 记录查询时延 P95 与失败率。
  4. [x] 固化默认检索参数并输出评估结论。

---

## W5 实体时间线波次（可并行，依赖 W4 + W3-E）

- [ ] **并行块 W5-A：时间线数据模型（前置：W4-C）**
  1. [ ] 创建 `entities/entity_aliases/events/event_entities/timeline_snapshots` 表。
  2. [ ] 实现实体归一与别名映射 repository。
  3. [ ] 实现事件版本字段与快照写入逻辑。
  4. [ ] 实现冲突检测（时间顺序/重复事件/实体冲突）。

- [ ] **并行块 W5-B：事件抽取工作流（前置：W5-A, W3-A）**
  1. [ ] 实现 Mastra Workflow 抽取候选实体与事件（结构化 JSON）。
  2. [ ] 实现代码侧校验、去重、排序、合并。
  3. [ ] 实现低置信度事件入人工确认队列。
  4. [ ] 实现章节改写触发“受影响事件重算”。

- [ ] **并行块 W5-C：时间线接口（前置：W5-B）**
  1. [ ] 实现 `POST /api/timeline/extract`。
  2. [ ] 实现 `GET /api/timeline/entity/:entityId`。
  3. [ ] 实现 `PATCH /api/timeline/events/:eventId`（confirm/reject/edit）。
  4. [ ] 返回统一时间线事件结构（含 `confidence/status`）。

- [ ] **并行块 W5-D：时间线前端（前置：W5-C, W2-B）**
  1. [ ] 实现实体列表与实体详情页。
  2. [ ] 实现按章节排序的时间线视图。
  3. [ ] 实现低置信度事件审核 UI。
  4. [ ] 实现事件编辑/确认/拒绝交互与状态刷新。
  5. [ ] 验证“章节修改 -> 时间线自动更新”链路。

---

## W6 GraphRAG 增强波次（可选并行，依赖 W4）

- [ ] **并行块 W6-A：GraphRAG 接入（前置：W4-C）**
  1. [ ] 接入 `createGraphRAGTool` 并完成最小调用链路。
  2. [ ] 建立关系查询专用检索入口。
  3. [ ] 将 GraphRAG 结果纳入统一证据结构。

- [ ] **并行块 W6-B：触发策略与防噪（前置：W6-A）**
  1. [ ] 实现“仅关系型问题触发 GraphRAG”的策略开关。
  2. [ ] 实现阈值与回退机制（噪声过高回退基线检索）。
  3. [ ] 记录是否启用 GraphRAG 到响应字段。

- [ ] **并行块 W6-C：A/B 评估（前置：W6-B, W4-D）**
  1. [ ] 构建关系型查询测试集。
  2. [ ] 对比基线检索与 GraphRAG 的召回率与噪声。
  3. [ ] 输出是否默认启用 GraphRAG 的决策结论。

---

## W7 导入导出、快照与收尾波次（可并行，依赖 W5 + W6(可选)）

- [ ] **并行块 W7-A：导入导出能力（前置：W5-C）**
  1. [ ] 实现项目 JSON 导入导出。
  2. [ ] 实现章节多格式导入（docx/pdf/epub 解析接口对接）。
  3. [ ] 实现导入错误报告与可恢复提示。

- [ ] **并行块 W7-B：快照系统（前置：W5-A）**
  1. [ ] 实现自动快照（按编辑里程碑/间隔）。
  2. [ ] 实现手动创建快照与恢复。
  3. [ ] 实现快照差异展示（章节与时间线）。

- [ ] **并行块 W7-C：测试与性能（前置：W7-A, W7-B）**
  1. [ ] 完成核心单元测试（context-engine、RAG、timeline、SSE、审批状态机）。
  2. [ ] 在 60s 超时约束下执行测试命令并修复失败项。
  3. [ ] 完成静态检查与格式化校验。
  4. [ ] 完成关键路径性能优化并记录前后对比。

- [ ] **并行块 W7-D：文档与验收（前置：W7-C）**
  1. [ ] 更新架构文档、接口文档、运行文档。
  2. [ ] 跑通完整闭环验收：新建 -> 写作 -> AI -> 快照 -> 导出。
  3. [ ] 输出发布前检查清单并完成最终勾选。

---

## 全局验收勾选

- [ ] 应用可启动且核心页面可访问。
- [ ] AI 流式生成稳定、可中断、可回填。
- [ ] RAG 跨章节召回稳定且可返回证据。
- [ ] 时间线可抽取、可审核、可追溯、可重算。
- [ ] Tool 写操作均经过审批并可审计。
- [ ] 完成闭环：新建 -> 写作 -> AI -> 快照 -> 导出。
