# CatNovel 运行文档（W7）

## 1. 环境要求

- Node.js 20+
- pnpm 9+
- Linux/macOS 需可用 `timeout` 命令（60s 约束入口依赖）

## 2. 安装依赖

```bash
pnpm install
```

## 3. 启动服务

默认端口 `3000`：

```bash
pnpm dev
```

如果使用其它端口，设置：

```bash
export CATNOVEL_BASE_URL=http://127.0.0.1:3100
```

## 4. 校验入口（60s）

### 静态检查

```bash
pnpm run verify:static:60s
```

包含：

- `eslint scripts --max-warnings=0`
- `node --check`（`scripts/*.mjs` 语法检查）
- `scripts/format-check.mjs`

可选：需要全仓类型检查时手动执行 `pnpm run typecheck`。

### 核心 smoke（context-engine/RAG/timeline/SSE/审批状态机）

```bash
pnpm run verify:smoke:60s
```

脚本：`scripts/w7-core-smoke.mjs`

### RAG 性能校验

```bash
pnpm run verify:perf:60s
```

脚本：`scripts/w7-rag-perf.mjs`

默认阈值：

- `RAG_P95_BUDGET_MS=1500`
- `RAG_FAILURE_RATE_MAX=0.1`
- `RAG_RECALL_AT_K_MIN=0.75`

可通过环境变量覆盖。

### 全量入口

```bash
pnpm run verify:all
```

## 5. 常见故障

1. `ECONNREFUSED`
   - 原因：服务未启动或 `CATNOVEL_BASE_URL` 配置错误。
   - 处理：确认 `pnpm dev` 正常运行并检查端口。

2. `rag reindex timeout`
   - 原因：索引任务未在轮询窗口内完成。
   - 处理：重试并检查数据库文件写入权限、章节数据是否正常。

3. `APPROVAL_NOT_READY`
   - 原因：审批状态不是 `approved`（如 `pending/rejected`）。
   - 处理：先调用审批接口，再进行二次执行。
