"use client";

import type { ChapterItem, ProjectItem } from "@/components/workspace/types";
import { ApprovalCenter } from "@/components/ai-sidebar/approval-center";
import { ChatPanel } from "@/components/ai-sidebar/chat-panel";
import { GhostActions } from "@/components/ai-sidebar/ghost-actions";

type RightSidebarProps = {
  project: ProjectItem | null;
  chapter: ChapterItem | null;
  onAcceptGhost: (ghostText: string) => Promise<void>;
};

export function RightSidebar({
  project,
  chapter,
  onAcceptGhost,
}: RightSidebarProps) {
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

      <ChatPanel projectId={project?.id ?? null} chapterId={chapter?.id ?? null} />

      <GhostActions
        projectId={project?.id ?? null}
        chapter={chapter}
        onAcceptGhost={onAcceptGhost}
      />

      <ApprovalCenter projectId={project?.id ?? null} />
    </section>
  );
}
