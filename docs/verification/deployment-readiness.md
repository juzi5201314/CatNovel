# Deployment Readiness — author-replica

## Target runtime

- Self-hosted Node runtime
- Persistent-volume SQLite
- No Electron shell
- No cloud account system

## Bootstrap / restore / migration

### Backup / restore / migration

- [ ] clean database bootstrap 可通过
- [ ] existing database migration 可通过
- [ ] startup migration verification 可输出明确结果
- [ ] backup script 可生成可恢复产物
- [ ] restore rehearsal 完成且可复现

## Health / readiness

- [ ] health endpoint
- [ ] readiness endpoint
- [ ] DB busy / lock retry policy
- [ ] import/export 大文件边界可观测

## Failure-path expectations

- [ ] persistence failure 有用户可理解反馈
- [ ] import 失败事务回滚
- [ ] snapshot restore 失败可恢复
- [ ] AI provider timeout 有降级提示

## Evidence to attach

最终需要追加：

1. bootstrap 命令与输出
2. migration rehearsal 输出
3. backup / restore 命令与校验结果
4. health / readiness 响应样本
5. 失败路径日志样本
