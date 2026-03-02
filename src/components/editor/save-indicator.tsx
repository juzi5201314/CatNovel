"use client";

import type { EditorSaveStatus } from "./types";

type SaveIndicatorProps = {
  status: EditorSaveStatus;
  dirty: boolean;
  wordCount: number;
};

function resolveLabel(status: EditorSaveStatus, dirty: boolean): string {
  if (status === "saving") {
    return "保存中";
  }

  if (status === "saved") {
    return "已保存";
  }

  if (status === "error") {
    return "保存失败";
  }

  return dirty ? "未保存" : "待编辑";
}

function resolveTone(status: EditorSaveStatus): string {
  if (status === "saving") {
    return "text-[#21636b]";
  }

  if (status === "saved") {
    return "text-emerald-700";
  }

  if (status === "error") {
    return "text-red-700";
  }

  return "text-[var(--cn-text-secondary)]";
}

export function SaveIndicator({ status, dirty, wordCount }: SaveIndicatorProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={resolveTone(status)}>{resolveLabel(status, dirty)}</span>
      <span className="text-[var(--cn-text-secondary)]">字数 {wordCount}</span>
    </div>
  );
}
