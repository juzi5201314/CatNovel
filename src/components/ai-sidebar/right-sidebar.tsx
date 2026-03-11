"use client";

import { useState } from "react";
import type {
  ChapterItem,
  ProjectItem,
  ProjectSnapshotDiff,
  ProjectSnapshotSummary,
  SnapshotRestoreResult,
} from "@/components/workspace/types";
import { ChatZoomIcon } from "@/components/ai-sidebar/chat-zoom-icon";
import { ChatPanel } from "@/components/ai-sidebar/chat-panel";
import { GhostActions } from "@/components/ai-sidebar/ghost-actions";
import { SnapshotPanel } from "@/components/ai-sidebar/snapshot-panel";
import { TimelinePanel } from "@/components/timeline/timeline-panel";

type RightSidebarProps = {
  project: ProjectItem | null;
  chapter: ChapterItem | null;
  snapshots: ProjectSnapshotSummary[];
  snapshotDiff: ProjectSnapshotDiff | null;
  snapshotRestoreResult: SnapshotRestoreResult | null;
  loadingSnapshots: boolean;
  creatingSnapshot: boolean;
  loadingSnapshotDiff: boolean;
  restoringSnapshotId: string | null;
  chatExpanded: boolean;
  onAcceptGhost: (ghostText: string) => Promise<void>;
  onRefreshSnapshots: () => Promise<void>;
  onCreateSnapshot: (reason?: string) => Promise<void>;
  onRestoreSnapshot: (snapshotId: string, reason?: string) => Promise<void>;
  onLoadSnapshotDiff: (snapshotId: string) => Promise<void>;
  onClearSnapshotDiff: () => void;
  onExpandChat: () => void;
  onCollapseChat: () => void;
};

type AITab = "chat" | "ghost" | "history";

export function RightSidebar({
  project,
  chapter,
  snapshots,
  snapshotDiff,
  snapshotRestoreResult,
  loadingSnapshots,
  creatingSnapshot,
  loadingSnapshotDiff,
  restoringSnapshotId,
  chatExpanded,
  onAcceptGhost,
  onRefreshSnapshots,
  onCreateSnapshot,
  onRestoreSnapshot,
  onLoadSnapshotDiff,
  onClearSnapshotDiff,
  onExpandChat,
  onCollapseChat,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<AITab>("chat");

  return (
    <aside
      className={`fixed top-0 overflow-hidden border-l border-border bg-background flex h-full flex-col ${
        chatExpanded
          ? "left-[var(--cn-sidebar-left)] right-0 z-30 w-auto shadow-2xl"
          : "right-0 w-[var(--cn-sidebar-right)]"
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Header / Context */}
        <div className="p-6 border-bottom border-border bg-muted/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Assistant</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-medium text-muted-foreground">Connected</span>
              </div>
              {chatExpanded ? (
                <button
                  type="button"
                  onClick={onCollapseChat}
                  className="h-7 w-7 p-0 rounded-full border border-border bg-background text-foreground shadow-sm transition-all hover:shadow-md"
                  title="缩小返回侧栏"
                  aria-label="缩小返回侧栏"
                  style={{ padding: 0, gap: 0 }}
                >
                  <ChatZoomIcon mode="collapse" />
                </button>
              ) : null}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-12">Project:</span>
              <span className="font-medium truncate">{project ? project.name : "None selected"}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-12">Chapter:</span>
              <span className="font-medium truncate">{chapter ? `${chapter.orderNo}. ${chapter.title}` : "None selected"}</span>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex px-4 border-b border-border">
          <button 
            className={`flex-1 py-3 text-xs font-medium border-b-2 transition-all ${activeTab === 'chat' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('chat')}
          >
            AI Chat
          </button>
          <button
            className={`flex-1 py-3 text-xs font-medium border-b-2 transition-all ${activeTab === 'ghost' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('ghost')}
          >
            Ghost Text
          </button>
          <button 
            className={`flex-1 py-3 text-xs font-medium border-b-2 transition-all ${activeTab === 'history' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 p-4">
          <div className={`relative h-full ${activeTab === "chat" ? "animate-in fade-in duration-300" : "hidden"}`}>
            {!chatExpanded ? (
              <button
                type="button"
                onClick={onExpandChat}
                className="absolute right-2 top-16 z-10 h-8 w-8 p-0 rounded-full border border-border bg-background text-foreground shadow-sm transition-all hover:shadow-md"
                title="放大到主区域"
                aria-label="放大到主区域"
                style={{ padding: 0, gap: 0 }}
              >
                <ChatZoomIcon mode="expand" />
              </button>
            ) : null}
            <div className="h-full">
              <ChatPanel projectId={project?.id ?? null} chapterId={chapter?.id ?? null} />
            </div>
          </div>

          <div
            className={`h-full overflow-y-auto custom-scrollbar ${activeTab === "ghost" ? "space-y-6 animate-in fade-in duration-300" : "hidden"}`}
          >
            <GhostActions projectId={project?.id ?? null} chapter={chapter} onAcceptGhost={onAcceptGhost} />
          </div>

          <div
            className={`h-full overflow-y-auto custom-scrollbar ${activeTab === "history" ? "space-y-6 animate-in fade-in duration-300" : "hidden"}`}
          >
            <TimelinePanel projectId={project?.id ?? null} chapterId={chapter?.id ?? null} />
            <SnapshotPanel
              projectId={project?.id ?? null}
              snapshots={snapshots}
              snapshotDiff={snapshotDiff}
              snapshotRestoreResult={snapshotRestoreResult}
              loadingSnapshots={loadingSnapshots}
              creatingSnapshot={creatingSnapshot}
              loadingSnapshotDiff={loadingSnapshotDiff}
              restoringSnapshotId={restoringSnapshotId}
              onRefresh={onRefreshSnapshots}
              onCreate={onCreateSnapshot}
              onRestore={onRestoreSnapshot}
              onLoadDiff={onLoadSnapshotDiff}
              onClearDiff={onClearSnapshotDiff}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
