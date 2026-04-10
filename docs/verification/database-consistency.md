# Database Consistency Checklist — author-replica

## Canonical truth rule

根据 PRD，SQLite schema + repository/service layer 是唯一业务真相。

任何以下信息都必须能从 canonical schema 推导，而不是只存在 client store：

- works
- volumes
- chapters
- settings nodes
- snapshots
- chat sessions / messages
- context selections / summaries
- generation archive
- token usage
- import jobs
- export jobs
- preferences

## Required invariants

### Save / reload proof

1. 编辑器保存后，章节正文写入 canonical record。
2. 页面刷新后，从 SQLite 恢复同一章节最新内容。
3. 不允许依赖浏览器本地缓存作为唯一真相。

### Snapshot invariants

1. snapshot 是不可变记录。
2. restore 必须恢复章节 / 设定 / 聊天 / 偏好的一致视图。
3. 删除 snapshot 不得影响已恢复数据。

### Import / export job invariants

1. 每次 import 都要有 auditable job 记录。
2. 每次 export 都要能回溯到 canonical record 与参数。
3. 失败 import 必须回滚事务，不得留下半成品章节或孤儿关联。

### AI / archive invariants

1. token usage 记录必须能关联到具体 generation / provider profile / model。
2. chat session 与 message 必须可重建完整对话顺序。
3. ghost text 接受后的正文结果必须进入 canonical chapter record。

## Proof artifacts

最终需要在这里贴入或链接：

1. schema snapshot / migration output
2. 关键 SQL 断言或 integration test 输出
3. snapshot restore 前后 diff
4. import rollback 失败用例输出
5. token archive / generation archive 示例
