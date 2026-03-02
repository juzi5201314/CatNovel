# CatNovel 架构文档（W7-C/W7-D）

## 1. 范围与目标

本文档覆盖以下核心模块与验证策略：

- `context-engine`：`/api/ai/chat` 的上下文准备与 SSE token 流。
- `RAG`：`/api/rag/*` 的索引、查询与嵌入能力。
- `timeline`：`/api/timeline/*` 的事件抽取、实体聚合与事件读取。
- `审批状态机`：`/api/tools/execute` + `/api/tool-approvals/*` 的审批流与执行流。
- `SSE`：`/api/ai/chat` 与 `/api/tool-approvals/stream`。

## 2. 逻辑分层

1. API 层（`src/app/api/**`）
2. 领域层（`src/core/**`、`src/mastra/**`）
3. 仓储层（`src/repositories/**`）
4. 数据层（SQLite + `src/db/migrations/**`）

## 3. 核心调用链

```text
Client
  ├─ POST /api/ai/chat
  │    ├─ prepareChatStream -> resolveContext(context-engine)
  │    └─ runChatStream -> SSE(token/tool_call/context_used/done)
  │
  ├─ POST /api/rag/reindex -> GET /api/rag/index-status -> POST /api/rag/query
  │
  ├─ POST /api/timeline/extract -> GET /api/timeline/entities -> GET /api/timeline/entity/:id
  │
  └─ POST /api/tools/execute (write tool)
       ├─ requires_approval -> tool_approvals(status=pending)
       ├─ POST /api/tool-approvals/:id/approve|reject
       └─ POST /api/tools/execute (approvalId) -> executed|APPROVAL_NOT_READY
```

## 4. 测试与性能入口（60s 约束）

- 静态校验：`pnpm run verify:static:60s`
- 核心 smoke：`pnpm run verify:smoke:60s`
- RAG 性能：`pnpm run verify:perf:60s`
- 汇总入口：`pnpm run verify:all`

上述入口均通过 `timeout 60s` 包裹，避免长时间阻塞。

## 5. 最小覆盖策略

`scripts/w7-core-smoke.mjs` 覆盖点：

1. `context-engine`：断言 `tool_call/context_used/token/done` SSE 事件序列。
2. `RAG`：断言索引完成 + 查询命中目标章节。
3. `timeline`：断言抽取出事件并可读取实体时间线。
4. `SSE`：断言审批流 snapshot 事件与 payload。
5. `审批状态机`：断言 `pending -> approved -> executed` 与 `pending -> rejected`，并验证 rejected 不可执行。

`scripts/w7-rag-perf.mjs` 覆盖点：

- `p95LatencyMs`、`failureRate`、`recallAtK` 三项指标断言。
- 阈值可通过环境变量覆写（`RAG_P95_BUDGET_MS` 等）。
