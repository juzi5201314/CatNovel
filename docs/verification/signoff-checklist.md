# Signoff Checklist — author-replica

> 可在仓库根目录运行：
>
> - `bash scripts/verification/check-signoff-readiness.sh`
> - `bash scripts/verification/check-signoff-readiness.sh --final`
>
> 前者检查结构完整性与验收资产是否齐全；后者额外要求
> `docs/feature-matrix.md` 已全部收敛到最终状态。
> 在实现尚未完成前，`--final` 失败是预期行为。

## Capability gate

- [ ] `docs/feature-matrix.md` 所有 capability 已收敛为 `implemented` 或 `explicitly removed by requirement`
- [ ] 无 `todo` / `planned` / `in_progress` / `unknown`

## Removed items gate

- [ ] theme switch 不存在
- [ ] layout mode switch 不存在
- [ ] cloud sync / account / login / register / collaboration 不存在
- [ ] traditional mode 不存在
- [ ] screenplay mode 不存在
- [ ] electron shell / updater / desktop packaging 不存在

## Coverage gate

- [ ] zh / en / ru 完整覆盖
- [ ] import 覆盖 txt / md / epub / docx / doc / pdf
- [ ] export 覆盖 txt / md / docx / epub / pdf / project JSON
- [ ] AI family 覆盖 OpenAI-compatible / Gemini-native / Claude-native / custom endpoint
- [ ] SQLite canonical schema 覆盖 works / chapters / settings / snapshots / chat / preferences / archives / jobs

## Evidence gate

- [ ] `docs/verification/feature-gap-report.md`
- [ ] `docs/verification/manual-test-script.md`
- [ ] `docs/verification/database-consistency.md`
- [ ] `docs/verification/design-audit.md`
- [ ] `docs/verification/deployment-readiness.md`
- [ ] 自动化测试结果
- [ ] lane-level evidence（route / database / editor / import-export / AI）

## Final rule

只有全部勾选后，才允许宣布 project complete。
