"use client";

import type { ChapterItem, ProjectItem } from "@/components/workspace/types";

type RightSidebarProps = {
  project: ProjectItem | null;
  chapter: ChapterItem | null;
};

export function RightSidebar({ project, chapter }: RightSidebarProps) {
  return (
    <section className="cn-column cn-column-right">
      <header className="cn-column-header">
        <h2>Assistant</h2>
        <span>未连接</span>
      </header>

      <article className="cn-panel cn-panel-soft">
        <h3 className="cn-card-title">上下文</h3>
        <p className="cn-card-description">
          项目：{project ? project.name : "未选择"}
        </p>
        <p className="cn-card-description">
          章节：{chapter ? `${chapter.orderNo}. ${chapter.title}` : "未选择"}
        </p>
      </article>

      <article className="cn-panel">
        <h3 className="cn-card-title">AI 侧栏占位</h3>
        <p className="cn-card-description">
          W3 将在这里接入消息流、Ghost Text 与工具审批通知。
        </p>
      </article>
    </section>
  );
}
