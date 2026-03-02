# CatNovel 接口文档（W7 核心）

## 1. context-engine / SSE 聊天

### `POST /api/ai/chat`

用途：基于上下文检索结果返回流式聊天输出（SSE）。

请求体示例：

```json
{
  "projectId": "proj_xxx",
  "chapterId": "chap_xxx",
  "messages": [{ "role": "user", "content": "请给我剧情建议" }],
  "retrieval": { "topK": 4, "enableGraph": "off" },
  "override": { "apiFormat": "chat_completions", "modelId": "smoke-model" }
}
```

SSE 事件：

- `tool_call`
- `context_used`
- `token`
- `done`
- `error`（异常时）

## 2. RAG

### `POST /api/rag/reindex`

请求体：

```json
{
  "projectId": "proj_xxx",
  "reason": "full_rebuild"
}
```

### `GET /api/rag/index-status?projectId=...`

返回字段：

- `indexedChapters`
- `indexedChunks`
- `pendingJobs`
- `lastBuildAt`

### `POST /api/rag/query`

请求体示例：

```json
{
  "projectId": "proj_xxx",
  "query": "第一章出现的医生是谁",
  "strategy": "auto",
  "topK": 5
}
```

返回字段：

- `answer`
- `usedGraphRag`
- `hits`
- `events`

## 3. timeline

### `POST /api/timeline/extract`

请求体示例：

```json
{
  "projectId": "proj_xxx",
  "chapterId": "chap_xxx",
  "force": true
}
```

返回字段：

- `extractedEvents`
- `lowConfidenceEvents`
- `events`

### `GET /api/timeline/entities?projectId=...`

返回字段：

- `entities[]`（含 `entityId/name/type/aliases`）

### `GET /api/timeline/entity/:entityId?projectId=...`

返回字段：

- `entity`
- `aliases`
- `timeline`

## 4. 审批状态机 + 审批 SSE

### `POST /api/tools/execute`

写操作工具（如 `timeline.upsertEvent`）的典型流程：

1. 首次调用返回：

```json
{
  "status": "requires_approval",
  "approvalId": "approval_xxx"
}
```

2. 审批通过后，携带 `approvalId` 二次调用，返回：

```json
{
  "status": "executed",
  "result": {}
}
```

3. 若审批被拒绝，二次执行返回 `APPROVAL_NOT_READY`（HTTP 409）。

### `GET /api/tool-approvals?projectId=...&status=pending`

查询审批列表。

### `POST /api/tool-approvals/:id/approve`

请求体：

```json
{ "comment": "approved by smoke" }
```

### `POST /api/tool-approvals/:id/reject`

请求体：

```json
{ "reason": "rejected by smoke" }
```

### `GET /api/tool-approvals/:id`

读取审批详情与执行日志。

### `GET /api/tool-approvals/stream?projectId=...`

SSE 事件：

- `tool_approvals_snapshot`（包含 pending 审批快照）
