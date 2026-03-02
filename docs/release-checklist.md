# 发布前检查清单（W7）

## 1. 必跑命令

1. `pnpm run verify:static:60s`
2. `pnpm run verify:smoke:60s`
3. `pnpm run verify:perf:60s`

全部通过后才可进入发布流程。

## 2. 功能覆盖核对

1. `context-engine`
   - `POST /api/ai/chat` 可返回 `tool_call/context_used/token/done`。
2. `RAG`
   - `reindex -> index-status -> query` 链路通过。
3. `timeline`
   - `extract` 有事件产出，`entities/entity/:id` 可查询。
4. `SSE`
   - `tool-approvals/stream` 能收到 `tool_approvals_snapshot`。
5. `审批状态机`
   - 验证 `pending -> approved -> executed`。
   - 验证 `pending -> rejected` 后不能执行（`APPROVAL_NOT_READY`）。

## 3. 性能门禁

默认阈值（可按环境覆写）：

- `p95LatencyMs <= 1500`
- `failureRate <= 0.1`
- `recallAtK >= 0.75`

## 4. 文档完整性

以下文档需与代码保持一致：

1. `docs/architecture.md`
2. `docs/api.md`
3. `docs/runbook.md`
4. `docs/release-checklist.md`

## 5. 发布阻断条件

任一项出现即阻断发布：

1. 60s 校验入口超时。
2. smoke/perf 脚本失败。
3. 审批流状态机行为与预期不一致。
4. 文档与实际接口不一致。
