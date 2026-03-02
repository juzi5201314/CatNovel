"use client";

import { FormEvent, useMemo, useState } from "react";

import type {
  ProjectSnapshotDiff,
  ProjectSnapshotSummary,
  SnapshotRestoreResult,
  SnapshotTextDiffLine,
} from "@/components/workspace/types";

type SnapshotPanelProps = {
  projectId: string | null;
  snapshots: ProjectSnapshotSummary[];
  snapshotDiff: ProjectSnapshotDiff | null;
  snapshotRestoreResult: SnapshotRestoreResult | null;
  loadingSnapshots: boolean;
  creatingSnapshot: boolean;
  loadingSnapshotDiff: boolean;
  restoringSnapshotId: string | null;
  onRefresh: () => Promise<void>;
  onCreate: (reason?: string) => Promise<void>;
  onRestore: (snapshotId: string, reason?: string) => Promise<void>;
  onLoadDiff: (snapshotId: string) => Promise<void>;
  onClearDiff: () => void;
};

function formatTime(value: string): string {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    return value;
  }
  return timestamp.toLocaleString("zh-CN", { hour12: false });
}

function diffPrefix(op: SnapshotTextDiffLine["op"]): string {
  if (op === "add") {
    return "+";
  }
  if (op === "remove") {
    return "-";
  }
  return "=";
}

export function SnapshotPanel({
  projectId,
  snapshots,
  snapshotDiff,
  snapshotRestoreResult,
  loadingSnapshots,
  creatingSnapshot,
  loadingSnapshotDiff,
  restoringSnapshotId,
  onRefresh,
  onCreate,
  onRestore,
  onLoadDiff,
  onClearDiff,
}: SnapshotPanelProps) {
  const [reason, setReason] = useState("");
  const [restoreReason, setRestoreReason] = useState("");

  const chapterDiffStats = useMemo(() => {
    if (!snapshotDiff) {
      return null;
    }
    return snapshotDiff.chapters.reduce(
      (acc, item) => {
        acc[item.changeType] += 1;
        return acc;
      },
      {
        added: 0,
        removed: 0,
        modified: 0,
        unchanged: 0,
      },
    );
  }, [snapshotDiff]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate(reason.trim().length > 0 ? reason.trim() : undefined);
  }

  return (
    <article className="cn-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="cn-card-title">快照中心</h3>
        <span className="rounded-full border border-[var(--cn-border)] px-2 py-0.5 text-xs text-[var(--cn-text-secondary)]">
          {snapshots.length} 条
        </span>
      </div>

      {!projectId ? (
        <p className="cn-card-description">请选择项目后管理快照。</p>
      ) : (
        <>
          <form className="mt-2" onSubmit={handleCreate}>
            <label>
              <span className="text-xs text-[var(--cn-text-secondary)]">手动快照原因</span>
              <input
                className="mt-1 w-full rounded-md border border-[var(--cn-border)] p-2 text-sm"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="例如：阶段里程碑"
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="submit" disabled={creatingSnapshot}>
                {creatingSnapshot ? "创建中..." : "创建快照"}
              </button>
              <button
                type="button"
                onClick={() => void onRefresh()}
                disabled={loadingSnapshots}
              >
                {loadingSnapshots ? "刷新中..." : "刷新列表"}
              </button>
            </div>
          </form>

          <label className="mt-3 block">
            <span className="text-xs text-[var(--cn-text-secondary)]">恢复备注</span>
            <input
              className="mt-1 w-full rounded-md border border-[var(--cn-border)] p-2 text-sm"
              value={restoreReason}
              onChange={(event) => setRestoreReason(event.target.value)}
              placeholder="例如：回滚到提审版本"
            />
          </label>

          <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
            {snapshots.map((snapshot) => (
              <li
                key={snapshot.id}
                className="rounded-md border border-[var(--cn-border)] bg-white p-2"
              >
                <p className="text-sm font-semibold text-[var(--cn-text-primary)]">
                  {formatTime(snapshot.createdAt)} · {snapshot.triggerType}
                </p>
                <p className="mt-1 text-xs text-[var(--cn-text-secondary)]">
                  章节 {snapshot.chapterCount} · 事件 {snapshot.timelineEventCount}
                </p>
                <p className="mt-1 text-xs text-[var(--cn-text-secondary)]">
                  {snapshot.triggerReason}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void onLoadDiff(snapshot.id)}
                    disabled={loadingSnapshotDiff}
                  >
                    {loadingSnapshotDiff ? "读取中..." : "查看差异"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void onRestore(
                        snapshot.id,
                        restoreReason.trim().length > 0 ? restoreReason.trim() : undefined,
                      )
                    }
                    disabled={Boolean(restoringSnapshotId)}
                  >
                    {restoringSnapshotId === snapshot.id ? "恢复中..." : "恢复到此快照"}
                  </button>
                </div>
              </li>
            ))}

            {!loadingSnapshots && snapshots.length === 0 ? (
              <li>
                <p className="cn-card-description">暂无快照</p>
              </li>
            ) : null}
          </ul>
        </>
      )}

      {snapshotRestoreResult ? (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2">
          <p className="text-sm text-emerald-700">
            已恢复：章节 {snapshotRestoreResult.restoredChapterCount}，
            事件 {snapshotRestoreResult.restoredEventCount}。
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            来源快照：{snapshotRestoreResult.restoredFromSnapshotId}
          </p>
        </div>
      ) : null}

      {snapshotDiff ? (
        <div className="mt-3 rounded-md border border-[var(--cn-border)] bg-[var(--cn-surface-muted)] p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--cn-text-primary)]">快照差异</p>
            <button type="button" onClick={onClearDiff}>
              关闭
            </button>
          </div>
          <p className="mt-1 text-xs text-[var(--cn-text-secondary)]">
            基线：{formatTime(snapshotDiff.beforeSnapshot.createdAt)} → 当前：
            {formatTime(snapshotDiff.afterSnapshot.createdAt)}
          </p>
          {chapterDiffStats ? (
            <p className="mt-1 text-xs text-[var(--cn-text-secondary)]">
              章节变更：新增 {chapterDiffStats.added} / 修改 {chapterDiffStats.modified} / 删除{" "}
              {chapterDiffStats.removed}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-[var(--cn-text-secondary)]">
            时间线事件：{snapshotDiff.timeline.beforeEventCount} →{" "}
            {snapshotDiff.timeline.afterEventCount}
          </p>
          <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-[var(--cn-border)] bg-white p-2">
            {snapshotDiff.timeline.diffLines.slice(0, 30).map((line, index) => (
              <li key={`${line.op}-${index}`} className="text-xs text-[var(--cn-text-secondary)]">
                {diffPrefix(line.op)} {line.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
