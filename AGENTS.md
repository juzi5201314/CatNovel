# AGENTS.md (CatNovel)

适用范围：本文件所在目录及其所有子目录（整个仓库）。

## 0. 核心约束（不可违反）

1. Hard Cutover：只实现新架构，不做旧接口/旧存储/旧字段的兼容分支，除非用户明确要求。
2. 沟通语言：分析、解释、回答默认使用中文，可混用英文技术术语；代码标识符使用英文。
3. 质量优先：正确性与安全性优先于速度；不要引入“临时 hack”。
4. 避免猜测：遇到外部 API/协议/文档不确定，立即向用户索要准确文档或源码，不要脑补。
5. 危险操作确认：删除文件/目录、批量改动、改权限、回滚未提交代码（如 `git restore`）、移动数据目录等，必须先征得用户明确确认。

## 2. 仓库事实（以当前代码为准）

### 2.1 技术栈

1. Next.js App Router（`src/app`），Node runtime。
2. TypeScript + pnpm。
3. SQLite：`better-sqlite3` + `drizzle-orm`（BetterSQLite3 driver）。
4. 向量库：LanceDB（默认目录 `.data/lancedb`）。

### 2.2 数据库迁移（SQLite/Drizzle）

1. 迁移文件目录：`src/db/migrations/*.sql`（按文件名排序执行）。
2. 迁移触发：首次调用 `getDatabase()` / `getSqliteConnection()` 时自动执行（见 `src/db/client.ts`）。
3. 规则：不要改历史 migration 的语义；新增迁移一律新建更高序号的 `.sql` 文件。

### 2.3 内置 Seed（当前已有但未自动执行）

1. LLM 内置 Provider / Preset：`src/db/seeds/llm-seed.ts`（`seedBuiltinLlmConfig()`，包含 DeepSeek baseURL）。
2. Tool Policy：`src/db/seeds/tool-policy-seed.ts`（`seedToolPolicies()`）。
3. 这两个 seed 函数当前是“可调用”，但不会在应用启动时自动跑；需要由初始化流程显式编排。

### 2.4 Secret 加密与环境变量

1. Secret 加密实现：`src/lib/crypto/secret-crypto.ts`（AES-256-GCM）。
2. 主密钥环境变量：`CATNOVEL_SECRET_KEY`。
3. 生产环境：缺少 `CATNOVEL_SECRET_KEY` 会抛错。
4. 开发环境：缺少 `CATNOVEL_SECRET_KEY` 会使用并持久化 `.data/dev-secret.key`（不要提交到 git）。

### 2.5 关键环境变量（约定）

1. `DATABASE_URL`：SQLite 路径（默认 `./.data/catnovel.sqlite`）。
2. `CATNOVEL_LANCEDB_URI`：LanceDB 数据目录（默认 `.data/lancedb`）。
3. `CATNOVEL_BASE_URL`：烟测脚本请求的服务地址（默认 `http://127.0.0.1:3000`）。

## 4. 开发与验证（命令）

### 4.1 常用命令（优先使用 pnpm scripts）

1. 静态检查（60s）：`pnpm run verify:static:60s`
2. 单元测试（60s）：`pnpm run verify:unit:60s`
3. 合约/脚本验证（60s）：`pnpm run verify:contract:60s`
4. 核心烟测（60s）：`pnpm run verify:smoke:60s`
5. 全量验证：`pnpm run verify:all`

### 4.2 测试约束

1. 新增测试优先放 `tests/unit/*.test.ts`（Node 内置 test runner）。
2. 后台跑测试时避免卡死：单次验证建议使用带 `timeout 60s` 的脚本（参考 `package.json`）。

## 5. 代码约定（API/Repo）

1. API Route Handler：统一使用 `ok()/fail()/internalError()/parseJsonBody()`（`src/lib/http/api-response.ts`）。
2. 输入校验：优先放在 `src/lib/http/*validators*.ts`，Route 只做解析与编排。
3. 数据访问：优先通过 `src/repositories/*`；除迁移/初始化这类底层编排外，不在 Route 里写裸 SQL。
4. 不引入兼容层：旧字段/旧枚举/旧接口一律直接删或直接改，除非用户要求保留。

## 6. 安全与隐私

1. 禁止在日志/错误详情里输出 API Key、明文 secret、用户全文等敏感信息。
2. `.env` 可能包含敏感配置：任何文档/示例只写变量名，不写真实值。
3. 对 “写操作/高风险操作” 的 Tool 调用必须走审批流（对应表/仓储已存在）。

