"use client";

import { useState } from "react";
import type {
  ChapterItem,
  ProjectItem,
  ProjectSnapshotDiff,
  ProjectSnapshotSummary,
  SnapshotRestoreResult,
} from "@/components/workspace/types";
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
  onAcceptGhost: (ghostText: string) => Promise<void>;
  onRefreshSnapshots: () => Promise<void>;
  onCreateSnapshot: (reason?: string) => Promise<void>;
  onRestoreSnapshot: (snapshotId: string, reason?: string) => Promise<void>;
  onLoadSnapshotDiff: (snapshotId: string) => Promise<void>;
  onClearSnapshotDiff: () => void;
  onExpandChat: () => void;
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
  onAcceptGhost,
  onRefreshSnapshots,
  onCreateSnapshot,
  onRestoreSnapshot,
  onLoadSnapshotDiff,
  onClearSnapshotDiff,
  onExpandChat,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<AITab>("chat");

  return (
    <aside className="flex flex-col h-full border-l border-border bg-background w-[var(--cn-sidebar-right)] fixed right-0 top-0 overflow-hidden">
      <div className="flex flex-col h-full">
        {/* Header / Context */}
        <div className="p-6 border-bottom border-border bg-muted/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Assistant</h2>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-medium text-muted-foreground">Connected</span>
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
        <div
          className={`flex-1 min-h-0 p-4 ${activeTab === "chat" ? "" : "overflow-y-auto custom-scrollbar"}`}
        >
          {activeTab === "chat" && (
            <div className="relative h-full animate-in fade-in duration-300">
              <button
                type="button"
                onClick={onExpandChat}
                className="absolute right-1 top-1 z-10 h-8 w-8 p-0 rounded-full border border-border bg-background text-foreground shadow-sm transition-all hover:shadow-md"
                title="放大到主区域"
                aria-label="放大到主区域"
              >
                <span aria-hidden="true" className="text-base leading-none">
                  ⤢
                </span>
              </button>
              <div className="h-full pt-10">
                <ChatPanel projectId={project?.id ?? null} chapterId={chapter?.id ?? null} />
              </div>
            </div>
          )}

          {activeTab === "ghost" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <GhostActions projectId={project?.id ?? null} chapter={chapter} onAcceptGhost={onAcceptGhost} />
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-6 animate-in fade-in duration-300">
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
          )}
        </div>
      </div>
    </aside>
  );
}
