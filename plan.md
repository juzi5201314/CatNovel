# CatNovel 重写开发计划（基于 REWRITE_PROMPT + Mastra）

更新时间：2026-03-02

## 1. 目标与硬约束

1. 采用 Hard Cutover：不保留旧架构兼容层，不做旧存储适配分支。  
2. Web Only：不实现 Electron 相关能力。  
3. 以 Mastra 作为 LLM 交互主库，统一承载：
   - 聊天/续写/改写等生成 API（流式）
   - Embedding 与检索工具
   - Agent/Workflow/Tool 编排
4. 小说全文进入 RAG：章节、设定、摘要、实体事件都可检索。  
5. 新增“实体时间线”能力：角色/建筑/物品等实体从首次出现到结局的事件链。  
6. 默认本地优先：仅在调用模型时发送必要文本。  

## 2. 技术路线决策

### 2.1 Mastra 适配结论

Mastra 官方文档已覆盖本项目关键能力：  
1. Next.js 集成与流式聊天（`handleChatStream` 等）  
2. RAG 全流程（chunk/embedding/vector/retrieval/rerank）  
3. GraphRAG（`createGraphRAGTool`）  
4. 自定义 API 路由与工具化扩展  

### 2.2 GraphRAG 是否“主方案”

结论：**不建议把 GraphRAG 作为唯一主检索方案**，建议采用“混合检索”。

原因：  
1. 你的核心目标是“第 80 章精准回忆第 9 章人物”，这是“高精度召回 + 明确证据”问题。  
2. GraphRAG适合“关系扩展”，但在长篇小说中若无约束容易引入噪声。  
3. 纯向量也不够，需要结构化实体与时间线来补足“精确定位”。  

建议策略：  
1. 默认：`元数据过滤 + 向量检索 + 重排`  
2. 条件触发：当问题涉及“关系链/跨章节关联”时启用 GraphRAG 扩展召回  
3. 所有回答都附带证据片段（chapter + chunk + event）  

### 2.3 时间线是否可完全交给 LLM 自动管理

结论：**可以让 LLM 自动提取与建议，但不能完全无约束自动落库**。

推荐机制：  
1. LLM 负责抽取候选实体/事件（结构化 JSON 输出）。  
2. 代码侧负责确定性校验与合并（去重、排序、冲突检测、版本化）。  
3. 低置信度事件进入人工确认队列；高置信度自动落库。  
4. 章节改写后触发“受影响事件重算”。  

### 2.4 已冻结技术栈（你已确认）

1. 框架与包管理：`Next.js（前后端一体） + pnpm`  
2. LLM 框架：`Mastra`  
3. 主数据库：`SQLite`  
4. 向量数据库：`LanceDB`  
5. ORM/查询层：`Drizzle`  
6. 运行时与部署：`Node runtime + Vercel`  
7. 鉴权策略：`v1 无登录（单用户本地优先）`  
8. 前端视觉体系：`Vercel Geist`（Geist Sans / Geist Mono + Geist Design System）  
9. API 协议能力：
   - Chat: `OpenAI Chat Completions 兼容` + `OpenAI Responses`
   - Embedding: `OpenAI 兼容 Embeddings`
   - 均支持自定义 `baseURL`、`modelId`、`thinking budget`（embedding 侧允许配置并保留字段）
10. 模型配置策略：支持可配置预设（供应商与模型）并可增删改查。  
11. 预置 Provider：仅内置
   - `Custom OpenAI Compatible`
   - `Custom OpenAI Responses`
   - `DeepSeek Official Compatible`（`baseURL=https://api.deepseek.com`）
   - 不内置 OpenAI 官方 Provider。  
12. 密钥策略：API Key 采用入库加密存储，不以明文形式落库。  
13. Tool 调用治理：
   - 读操作：允许 LLM 直接执行
   - 写操作/高风险操作：必须先生成审批请求，用户同意后执行  

## 3. 架构方案（v1）

### 3.1 总体架构

1. 前端：Next.js App Router + React + Zustand + TipTap + Geist。  
2. AI/RAG 层：Mastra（Agent + Workflow + Tools + Memory）。  
3. 业务数据存储：SQLite + Drizzle（Repository 抽象统一访问）。  
4. 向量存储：LanceDB（本地文件向量库）。  
5. 运行环境：Node runtime（部署到 Vercel）。  
6. 鉴权：v1 不做登录系统，保留后续扩展接口。  
7. 密钥存储：SQLite 加密字段（主密钥来自服务端环境变量）。  
8. LLM Tool：时间线/RAG/设定集能力均通过内置 Tool 暴露给 LLM。  
9. 文件解析：独立解析服务接口（docx/pdf/epub 等）。  

### 3.2 目录规划（建议）

```text
src/
  app/
    (workspace)/
    api/
      ai/chat/route.ts
      ai/generate/route.ts
      rag/query/route.ts
      rag/reindex/route.ts
      timeline/extract/route.ts
      timeline/entity/[id]/route.ts
      settings/providers/route.ts
      settings/providers/[id]/route.ts
      settings/model-presets/route.ts
      settings/model-presets/[id]/route.ts
      settings/llm-defaults/route.ts
      tools/execute/route.ts
      tool-approvals/route.ts
      tool-approvals/[id]/route.ts
      tool-approvals/[id]/approve/route.ts
      tool-approvals/[id]/reject/route.ts
      tool-approvals/stream/route.ts
  components/
    editor/
    sidebar/
    ai-sidebar/
    timeline/
  mastra/
    index.ts
    agents/
    workflows/
    tools/
  core/
    context-engine/
    retrieval/
    timeline/
  repositories/
  db/
    schema/
    migrations/
  i18n/
  styles/
```

## 4. 数据模型设计（关键）

### 4.1 RAG 索引元数据

每个 chunk 至少携带：  
1. `project_id`  
2. `chapter_no`  
3. `chapter_id`  
4. `chunk_id`  
5. `chunk_type`（正文/设定/摘要/事件）  
6. `entity_ids`（可空）  
7. `position_in_chapter`  
8. `updated_at`  

### 4.2 时间线核心表

1. `entities`：实体主表（角色/地点/物品/组织等）  
2. `entity_aliases`：别名与同义词  
3. `events`：事件表（摘要、发生章节、证据片段、置信度、版本）  
4. `event_entities`：事件与实体多对多关系  
5. `timeline_snapshots`：时间线快照（便于回滚和差异追踪）  

### 4.3 LLM 配置与预设表

1. `llm_providers`
   - `id`, `name`, `protocol(openai_compatible|openai_responses)`, `category(chat|embedding|both)`
   - `base_url`, `api_key_ref`, `enabled`, `is_builtin`, `builtin_code`
2. `llm_model_presets`
   - `id`, `provider_id`, `purpose(chat|embedding)`, `api_format(chat_completions|responses|embeddings)`, `model_id`, `temperature`, `max_tokens`
   - `thinking_budget_type(effort|tokens)`, `thinking_effort(low|medium|high)`, `thinking_tokens`, `is_builtin`
3. `llm_default_selection`
   - `project_id`, `default_chat_preset_id`, `default_embedding_preset_id`
4. `secret_store`（必需）
   - `id`, `ciphertext`, `nonce`, `tag`, `key_version`, `created_at`, `updated_at`
   - 仅服务端可读，用于保存加密后的 API Key  
5. 密钥加密策略
   - 算法：`AES-256-GCM`
   - 主密钥：`CATNOVEL_SECRET_KEY`（部署环境变量）
   - 支持 `key_version` 轮换，后台提供重加密任务  

### 4.4 内置 Provider 与 Preset Seed（v1）

1. 内置 Provider（不可删除，可编辑 `baseURL/apiKey/enabled`）
   - `builtin_openai_compatible`：`Custom OpenAI Compatible`，`protocol=openai_compatible`
   - `builtin_openai_responses`：`Custom OpenAI Responses`，`protocol=openai_responses`
   - `builtin_deepseek_compatible`：`DeepSeek Official Compatible`，`protocol=openai_compatible`，`baseURL=https://api.deepseek.com`
2. 内置 Preset（可修改，可新增，可删除非锁定项）
   - Chat-Completions 默认预设（绑定 `builtin_openai_compatible`）
   - Responses 默认预设（绑定 `builtin_openai_responses`）
   - DeepSeek Chat 默认预设（绑定 `builtin_deepseek_compatible`，默认模型 `deepseek-chat`）
   - DeepSeek Reasoner 默认预设（绑定 `builtin_deepseek_compatible`，默认模型 `deepseek-reasoner`）
   - Embedding 默认预设（绑定 `builtin_openai_compatible`，模型由用户填写）
3. 不提供 OpenAI 官方预置项。  

### 4.5 Tool 审批与审计表

1. `tool_approval_requests`
   - `id`, `project_id`, `tool_name`, `risk_level(read|write|high_risk)`, `request_payload`
   - `status(pending|approved|rejected|expired|executed)`, `reason`, `requested_at`, `approved_at`, `expires_at`
2. `tool_execution_logs`
   - `id`, `approval_id`, `tool_name`, `input_payload`, `output_payload`, `exec_status`, `created_at`
3. `tool_policies`
   - `tool_name`, `risk_level`, `requires_confirmation`, `enabled`

## 5. 检索与上下文编排策略

### 5.1 全文 embedding 策略

1. 全章节入库（不是只存摘要）。  
2. 双粒度切块：  
   - 细粒度：约 300~500 tokens，保留 overlap  
   - 粗粒度：章节摘要/场景摘要块  
3. 章节变更后增量重建相关 chunk 与向量。  

### 5.2 混合检索管线

1. Query 解析：识别“事实查找 / 关系追溯 / 创作续写”。  
2. 召回层：  
   - 元数据过滤（仅当前作品、章节范围）  
   - 向量 Top-K  
   - 实体别名精确匹配（防止人名漏召回）  
3. 可选扩展：GraphRAG（关系型问题触发）。  
4. 重排层：按语义相关性 + 时间一致性 + 章节距离加权。  
5. 上下文组装：当前章节 > 最近章节 > 相关设定 > 时间线事件 > 历史摘要。  

### 5.3 回答可解释性

每次回答返回：  
1. 命中 chunk 列表（chapter/chunk/score）  
2. 命中事件列表（event_id/entity_id/confidence）  
3. 是否启用了 GraphRAG  

## 6. 分阶段实施计划

### Phase 0：技术选型冻结（1-2 天）

1. 初始化 Next.js + Mastra + 基础目录（Node runtime）。  
2. 建立 SQLite + Drizzle migration 入口。  
3. 接入 LanceDB 并完成最小索引读写验证。  
4. 创建 LLM 配置表（provider/preset/default）与 Repository。  
5. 落地 Geist 字体与基础设计 token。  
6. 写入内置 Provider/Preset seed（含 DeepSeek baseURL）。  
7. 接入 `secret_store` 加密读写与密钥版本管理。  
8. 建立 Tool Policy 与审批请求表。  

验收：  
1. 应用可启动。  
2. Mastra agent 可返回流式文本。  
3. SQLite/Drizzle 与 LanceDB 可连通。  
4. 可创建一个 Chat Preset 与 Embedding Preset。  
5. API Key 入库后为密文，读取链路可正常解密。  
6. Tool 写操作可创建审批单并等待用户确认。  

### Phase 1：编辑器与项目骨架（3-5 天）

1. 三栏布局与基础导航。  
2. 章节 CRUD、项目 CRUD。  
3. TipTap 基础格式、统计栏、快捷键。  

验收：  
1. 可完成“新建作品 -> 新建章节 -> 编辑保存”。  

### Phase 2：AI 生成与 Ghost Text（4-6 天）

1. 接入 Mastra 聊天/续写/改写 API。  
2. 流式输出、中断、回填。  
3. Ghost Text 接受/拒绝/重生成。  
4. 设置页支持切换 Chat API 格式（Chat Completions / Responses）。  
5. 设置页支持 Embedding 预设选择与编辑。  
6. Tool 调用接入审批流（写/高风险触发通知）。  

验收：  
1. AI 可稳定流式生成并可中断。  
2. Ghost Text 行为完整。  
3. API 格式切换后可成功请求对应供应商。  

### Phase 3：RAG 全文索引（5-8 天）

1. 全章节 chunk + embedding + upsert。  
2. 增量重建与删除同步。  
3. 混合检索（过滤 + 向量 + 重排）。  

验收：  
1. 指定人物可跨章节稳定召回（含早期章节）。  
2. 返回带证据来源。  

### Phase 4：实体时间线系统（6-10 天）

1. 实体识别与别名归一。  
2. 事件抽取工作流（Mastra Workflow + Tool）。  
3. 自动排序与冲突检测。  
4. 时间线 UI（按章节/实体浏览）。  

验收：  
1. 实体可查看完整事件链。  
2. 章节修改后时间线能自动更新。  

### Phase 5：GraphRAG 增强（可选，3-5 天）

1. 接入 `createGraphRAGTool`。  
2. 配置触发策略（仅关系查询启用）。  
3. 与基线检索做 A/B 评估。  

验收：  
1. 关系问题召回率提升且噪声可控。  

### Phase 6：导入导出、快照与质量收尾（4-7 天）

1. 多格式章节导入与项目 JSON 导入导出。  
2. 快照自动/手动保存、恢复。  
3. 测试、性能优化、文档。  

验收：  
1. 跑通完整闭环：新建 -> 写作 -> AI -> 快照 -> 导出。  
2. 核心测试通过。  

## 7. 测试与评估

### 7.1 自动化测试

1. context-engine 组装优先级与 token budget。  
2. RAG 检索正确性（含元数据过滤）。  
3. 时间线事件抽取与冲突处理。  
4. SSE 流解析、Ghost Text 状态机。  
5. Tool 审批状态机（pending -> approved/rejected -> executed）。  

### 7.2 关键指标

1. `Recall@K`：跨章节人物召回率。  
2. `Evidence Precision`：证据片段与回答一致性。  
3. `Timeline Consistency`：事件顺序冲突率。  
4. 查询时延 P95。  

## 8. 风险与对策

1. 风险：全文 embedding 成本高  
   - 对策：增量索引 + 分批处理 + 冷热分层索引  
2. 风险：LLM 自动时间线漂移  
   - 对策：结构化输出 + 规则校验 + 低置信度人工审核  
3. 风险：GraphRAG 噪声引入  
   - 对策：仅按意图触发 + threshold 调优 + A/B 数据评估  

## 9. 当前建议的默认方案

1. 技术栈固定：`Next.js + pnpm + Mastra + SQLite + LanceDB + Drizzle + Node runtime + Vercel + Geist`。  
2. 先上线“混合检索 + 时间线结构化事件”，把精准召回打稳。  
3. GraphRAG 作为增强层，不作为第一阶段核心依赖。  
4. 时间线采用“LLM 抽取 + 程序治理 + 可审计回溯”的半自动方案。  
5. LLM 配置采用“供应商+模型预设”体系，支持 UI 级别增删改查。  
6. LLM 可调用内置 Tool，但写/高风险必须用户确认。  

## 10. 前端接口契约（v1）

### 10.1 项目与章节

1. `GET /api/projects`  
   - resp: `ProjectSummary[]`
2. `POST /api/projects`  
   - req: `{ name: string; mode: "webnovel" | "literary" | "screenplay" }`
   - resp: `ProjectDetail`
3. `GET /api/projects/:projectId/chapters`  
   - resp: `ChapterSummary[]`
4. `POST /api/projects/:projectId/chapters`  
   - req: `{ title: string; order: number }`
   - resp: `ChapterDetail`
5. `PATCH /api/chapters/:chapterId`  
   - req: `{ title?: string; content?: string; summary?: string }`
   - resp: `ChapterDetail`

### 10.2 AI 生成与对话（Mastra 流式）

1. `POST /api/ai/chat`（SSE/stream）  
   - req:
```json
{
  "projectId": "p1",
  "chapterId": "c80",
  "mode": "chat",
  "chatPresetId": "preset_chat_default",
  "messages": [{ "role": "user", "content": "..." }],
  "retrieval": { "enableGraph": "auto", "topK": 12 },
  "override": {
    "apiFormat": "chat_completions",
    "baseURL": "https://api.openai.com/v1",
    "modelId": "gpt-4.1",
    "thinkingBudget": { "type": "effort", "effort": "medium" }
  }
}
```
   - `override.apiFormat` 支持：`chat_completions | responses`
   - stream events:
     - `token`: 增量文本
     - `tool_call`: 工具调用过程
     - `context_used`: 命中证据（chunk/event）
     - `done`: 完成信号
2. `POST /api/ai/generate`（续写/改写/润色/扩写，SSE）  
   - req: `{ projectId, chapterId, taskType, selection?, prompt, chatPresetId?, override? }`
   - resp(stream): 与 `/api/ai/chat` 同结构

### 10.3 RAG 查询与重建

1. `POST /api/rag/query`  
   - req:
```json
{
  "projectId": "p1",
  "query": "第9章出现的那个医生是谁",
  "chapterScope": { "from": 1, "to": 80 },
  "strategy": "auto"
}
```
   - resp:
```json
{
  "answer": "...",
  "usedGraphRag": false,
  "hits": [{ "chapterNo": 9, "chunkId": "ch9_14", "score": 0.92 }],
  "events": [{ "eventId": "e102", "entityId": "char_doctor", "confidence": 0.88 }]
}
```
2. `POST /api/rag/reindex`  
   - req: `{ projectId: string; chapterIds?: string[]; reason: "chapter_updated" | "full_rebuild" }`
   - resp: `{ jobId: string; status: "queued" | "running" }`

### 10.4 Embedding 配置与索引

1. `POST /api/rag/embed`  
   - req: `{ projectId: string; embeddingPresetId?: string; texts: string[]; override?: { baseURL?: string; modelId?: string; thinkingBudget?: ThinkingBudget } }`
   - resp: `{ dimensions: number; vectors: number[][] }`
2. `GET /api/rag/index-status?projectId=p1`  
   - resp: `{ indexedChapters: number; pendingJobs: number; lastBuildAt?: string }`

### 10.5 时间线接口

1. `POST /api/timeline/extract`  
   - req: `{ projectId: string; chapterId: string; force?: boolean }`
   - resp: `{ extractedEvents: number; lowConfidenceEvents: number }`
2. `GET /api/timeline/entity/:entityId`  
   - resp: `{ entity, aliases, timeline: TimelineEvent[] }`
3. `PATCH /api/timeline/events/:eventId`  
   - req: `{ action: "confirm" | "reject" | "edit"; payload?: Partial<TimelineEvent> }`
   - resp: `{ success: true }`

### 10.6 设置页：供应商与模型预设管理

1. `GET /api/settings/providers`  
   - resp: `ProviderConfig[]`
2. `POST /api/settings/providers`  
   - req: `{ name, protocol, category, baseURL, apiKey, enabled }`
   - resp: `ProviderConfig`
3. `PATCH /api/settings/providers/:id`  
   - req: `{ name?, protocol?, baseURL?, apiKey?, enabled? }`
   - resp: `ProviderConfig`（内置 provider 的 `name/protocol` 不可修改）
4. `DELETE /api/settings/providers/:id`  
   - resp: `{ success: true }`（内置 provider 返回 `409`）
5. `GET /api/settings/model-presets`  
   - resp: `ModelPreset[]`
6. `POST /api/settings/model-presets`  
   - req: `{ providerId, purpose, apiFormat, modelId, thinkingBudget?, temperature?, maxTokens? }`
   - resp: `ModelPreset`
7. `PATCH /api/settings/model-presets/:id`  
   - req: `Partial<ModelPresetInput>`
   - resp: `ModelPreset`
8. `DELETE /api/settings/model-presets/:id`  
   - resp: `{ success: true }`
9. `PATCH /api/settings/llm-defaults`  
   - req: `{ projectId, defaultChatPresetId, defaultEmbeddingPresetId }`
   - resp: `{ success: true }`
10. `POST /api/settings/providers/:id/rotate-key`  
   - req: `{ apiKey: string }`
   - resp: `{ success: true; keyVersion: number }`

### 10.7 前端 TypeScript 契约（共享）

```ts
export type EvidenceHit = {
  chapterNo: number;
  chapterId: string;
  chunkId: string;
  score: number;
  snippet: string;
};

export type TimelineEvent = {
  eventId: string;
  entityId: string;
  chapterNo: number;
  title: string;
  description: string;
  confidence: number;
  status: "auto" | "confirmed" | "rejected";
};

export type RagAnswer = {
  answer: string;
  usedGraphRag: boolean;
  hits: EvidenceHit[];
  events: TimelineEvent[];
};

export type ThinkingBudget =
  | { type: "effort"; effort: "low" | "medium" | "high" }
  | { type: "tokens"; tokens: number };

export type ProviderConfig = {
  id: string;
  name: string;
  protocol: "openai_compatible" | "openai_responses";
  category: "chat" | "embedding" | "both";
  baseURL: string;
  enabled: boolean;
  isBuiltin: boolean;
};

export type ModelPreset = {
  id: string;
  providerId: string;
  purpose: "chat" | "embedding";
  apiFormat: "chat_completions" | "responses" | "embeddings";
  modelId: string;
  thinkingBudget?: ThinkingBudget;
  temperature?: number;
  maxTokens?: number;
};

export type ModelPresetInput = Omit<ModelPreset, "id">;

export type ToolApproval = {
  id: string;
  projectId: string;
  toolName: string;
  riskLevel: "read" | "write" | "high_risk";
  status: "pending" | "approved" | "rejected" | "expired" | "executed";
  summary: string;
  requestedAt: string;
  expiresAt?: string;
};

export type ToolExecuteResponse =
  | { status: "executed"; result: unknown }
  | { status: "requires_approval"; approvalId: string; summary: string };
```

### 10.8 LLM Tool 调用与审批接口

1. `POST /api/tools/execute`
   - req: `{ projectId, toolName, args, idempotencyKey? }`
   - resp(读操作): `{ status: "executed", result: any }`
   - resp(写/高风险): `{ status: "requires_approval", approvalId, summary }`
2. `GET /api/tool-approvals?projectId=p1&status=pending`
   - resp: `ToolApproval[]`
3. `GET /api/tool-approvals/:id`
   - resp: `ToolApproval`
4. `POST /api/tool-approvals/:id/approve`
   - req: `{ comment?: string }`
   - resp: `{ status: "approved" }`
5. `POST /api/tool-approvals/:id/reject`
   - req: `{ reason?: string }`
   - resp: `{ status: "rejected" }`
6. `GET /api/tool-approvals/stream?projectId=p1`（SSE）
   - 用于前端弹出通知与审批中心实时更新

### 10.9 Tool 风险分级（内置策略）

1. `read`（直接执行）
   - `rag.search`, `rag.getEvidence`, `timeline.getEntity`, `timeline.listEvents`, `lore.getNode`, `lore.listNodes`
2. `write`（需审批）
   - `timeline.upsertEvent`, `timeline.editEvent`, `lore.upsertNode`, `lore.deleteNode`, `rag.reindex`
3. `high_risk`（需审批，且默认二次确认）
   - `settings.providers.rotateKey`, `settings.providers.delete`, `settings.modelPresets.deleteBuiltinLocked`
