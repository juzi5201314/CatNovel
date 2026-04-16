'use client';

import { useState, useRef, useEffect } from 'react';
import { useMemo } from 'react';
import type {
  ActiveModelSelection,
  ChapterRecord,
  ProviderProfileRecord,
  VolumeRecord,
  WorkRecord,
} from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cx } from '@/lib/design/cx';

interface VolumeManagerPanelProps {
  volumes: VolumeRecord[];
  chapters: ChapterRecord[];
  draftVolumeTitle: string;
  onVolumeTitleChange: (value: string) => void;
  onCreateVolume: () => void;
  onUpdateVolume: (volumeId: string, title: string) => void;
  onDeleteVolume: (volumeId: string) => void;
  onDeleteChapter: (chapterId: string) => void;
  onClose: () => void;
}

interface WorkManagerPanelProps {
  works: WorkRecord[];
  activeWorkId: string;
  draftWorkTitle: string;
  onWorkChange: (workId: string) => void;
  onWorkTitleChange: (value: string) => void;
  onCreateWork: () => void;
  onUpdateWork: (workId: string, title: string) => void;
  onDeleteWork: (workId: string) => void;
  onClose: () => void;
}

function VolumeManagerPanel({
  volumes,
  chapters,
  draftVolumeTitle,
  onVolumeTitleChange,
  onCreateVolume,
  onUpdateVolume,
  onDeleteVolume,
  onDeleteChapter,
  onClose,
}: VolumeManagerPanelProps) {
  const [editingVolumeId, setEditingVolumeId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [expandedVolumes, setExpandedVolumes] = useState<Record<string, boolean>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const toggleVolume = (volumeId: string) => {
    setExpandedVolumes(prev => ({ ...prev, [volumeId]: !prev[volumeId] }));
  };

  const startEditing = (volume: VolumeRecord) => {
    setEditingVolumeId(volume.id);
    setEditingTitle(volume.title);
  };

  const saveEditing = () => {
    if (editingVolumeId && editingTitle.trim()) {
      onUpdateVolume(editingVolumeId, editingTitle.trim());
    }
    setEditingVolumeId(null);
    setEditingTitle('');
  };

  const cancelEditing = () => {
    setEditingVolumeId(null);
    setEditingTitle('');
  };

  const handleDeleteVolume = (volumeId: string, volumeTitle: string) => {
    if (confirm(`确定要删除卷 "${volumeTitle}" 吗？该卷下的所有章节也会被删除。此操作不可恢复。`)) {
      onDeleteVolume(volumeId);
    }
  };

  const handleDeleteChapter = (chapterId: string, chapterTitle: string) => {
    if (confirm(`确定要删除章节 "${chapterTitle}" 吗？此操作不可恢复。`)) {
      onDeleteChapter(chapterId);
    }
  };

  return (
    <div
      ref={panelRef}
      className="fixed left-[248px] top-[200px] w-[300px] bg-background rounded-lg shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_10px_40px_rgba(0,0,0,0.12)] z-[100] overflow-hidden"
    >
      <div className="p-3 border-b border-muted-foreground/10 flex items-center justify-between">
        <h3 className="text-sm font-semibold">章节与卷管理</h3>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="关闭"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      <div className="max-h-[400px] overflow-y-auto p-2 space-y-2">
        {volumes.map((volume) => {
          const isExpanded = expandedVolumes[volume.id] ?? true;
          const volumeChapters = chapters.filter(c => c.volumeId === volume.id);

          return (
            <div key={volume.id} className="space-y-1">
              <div className="group flex items-center gap-1 px-2 py-1.5 rounded-md transition-all duration-200 hover:bg-muted/50">
                <button
                  onClick={() => toggleVolume(volume.id)}
                  className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cx("transition-transform", isExpanded ? "" : "-rotate-90")}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {editingVolumeId === volume.id ? (
                  <div className="flex-1 flex items-center gap-1">
                    <Input
                      size={1}
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditing();
                        if (e.key === 'Escape') cancelEditing();
                      }}
                      className="h-6 text-xs flex-1"
                      autoFocus
                    />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={saveEditing}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={cancelEditing}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-left text-sm font-medium truncate text-foreground/90">
                      {volume.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {volumeChapters.length}章
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => startEditing(volume)}
                        title="重命名"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                        onClick={() => handleDeleteVolume(volume.id, volume.title)}
                        title="删除"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {isExpanded && volumeChapters.length > 0 && (
                <div className="pl-6 pr-2 space-y-1">
                  {volumeChapters.map((chapter) => (
                    <div
                      key={chapter.id}
                      className="group flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/30"
                    >
                      <span className="flex-1 text-left text-xs truncate text-foreground/80">
                        {chapter.title}
                      </span>
                      <span className="text-[9px] text-muted-foreground/60">
                        {chapter.wordCount}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60 hover:text-red-500"
                        onClick={() => handleDeleteChapter(chapter.id, chapter.title)}
                        title="删除章节"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-muted-foreground/10 bg-muted/20 space-y-2">
        <div className="flex gap-2">
          <Input
            size={1}
            value={draftVolumeTitle}
            onChange={(e) => onVolumeTitleChange(e.target.value)}
            placeholder="新卷名称"
            className="h-8 text-xs bg-background flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCreateVolume();
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs shadow-none"
            onClick={onCreateVolume}
          >
            创建卷
          </Button>
        </div>
      </div>
    </div>
  );
}

function WorkManagerPanel({
  works,
  activeWorkId,
  draftWorkTitle,
  onWorkChange,
  onWorkTitleChange,
  onCreateWork,
  onUpdateWork,
  onDeleteWork,
  onClose,
}: WorkManagerPanelProps) {
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const startEditing = (work: WorkRecord) => {
    setEditingWorkId(work.id);
    setEditingTitle(work.title);
  };

  const saveEditing = () => {
    if (editingWorkId && editingTitle.trim()) {
      onUpdateWork(editingWorkId, editingTitle.trim());
    }
    setEditingWorkId(null);
    setEditingTitle('');
  };

  const cancelEditing = () => {
    setEditingWorkId(null);
    setEditingTitle('');
  };

  const handleDelete = (workId: string, workTitle: string) => {
    if (confirm(`确定要删除作品 "${workTitle}" 吗？此操作不可恢复。`)) {
      onDeleteWork(workId);
    }
  };

  const handleWorkChange = (workId: string) => {
    onWorkChange(workId);
    onClose();
  };

  return (
    <div
      ref={panelRef}
      className="fixed left-[248px] top-[120px] w-[280px] bg-background rounded-lg shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_10px_40px_rgba(0,0,0,0.12)] z-[100] overflow-hidden"
    >
      <div className="p-3 border-b border-muted-foreground/10 flex items-center justify-between">
        <h3 className="text-sm font-semibold">作品管理</h3>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="关闭"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      <div className="max-h-[320px] overflow-y-auto p-2 space-y-1">
        {works.map((work) => (
          <div
            key={work.id}
            className={cx(
              "group flex items-center gap-1 px-2 py-2 rounded-md transition-all duration-200",
              work.id === activeWorkId
                ? "bg-muted/80"
                : "hover:bg-muted/50"
            )}
          >
            {editingWorkId === work.id ? (
              <div className="flex-1 flex items-center gap-1">
                <Input
                  size={1}
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEditing();
                    if (e.key === 'Escape') cancelEditing();
                  }}
                  className="h-7 text-xs flex-1"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={saveEditing}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={cancelEditing}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </Button>
              </div>
            ) : (
              <>
                  <button
                    onClick={() => handleWorkChange(work.id)}
                    className={cx(
                      "flex-1 text-left text-sm truncate",
                      work.id === activeWorkId ? "font-medium text-foreground" : "text-foreground/80"
                    )}
                  >
                    {work.title}
                  </button>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => startEditing(work)}
                    title="重命名"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-red-500"
                    onClick={() => handleDelete(work.id, work.title)}
                    title="删除"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-muted-foreground/10 bg-muted/20 space-y-2">
        <Input
          size={1}
          value={draftWorkTitle}
          onChange={(e) => onWorkTitleChange(e.target.value)}
          placeholder="新作品名称..."
          className="h-8 text-xs bg-background"
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs shadow-none"
          onClick={onCreateWork}
        >
          创建新作品
        </Button>
      </div>
    </div>
  );
}

export function SidebarNav({
  copy,
  works,
  volumes,
  chapters,
  activeWorkId,
  activeChapterId,
  draftWorkTitle,
  draftVolumeTitle,
  activeModel,
  providers,
  onWorkTitleChangeAction,
  onVolumeTitleChangeAction,
  onWorkChangeAction,
  onChapterChangeAction,
  onCreateWorkAction,
  onCreateVolumeAction,
  onCreateChapterAction,
  onOpenSettingsAction,
  onUpdateWorkAction,
  onDeleteWorkAction,
  onUpdateVolumeAction,
  onDeleteVolumeAction,
  onDeleteChapterAction,
  onUpdateChapterAction,
  onOpenWorldviewAction,
}: {
  copy: AppMessages;
  works: WorkRecord[];
  volumes: VolumeRecord[];
  chapters: ChapterRecord[];
  activeWorkId: string;
  activeChapterId: string;
  draftWorkTitle: string;
  draftVolumeTitle: string;
  activeModel: ActiveModelSelection | null;
  providers: ProviderProfileRecord[];
  onWorkTitleChangeAction: (value: string) => void;
  onVolumeTitleChangeAction: (value: string) => void;
  onWorkChangeAction: (workId: string) => void;
  onChapterChangeAction: (chapterId: string) => void;
  onCreateWorkAction: () => void;
  onCreateVolumeAction: () => void;
  onCreateChapterAction: (volumeId?: string) => void;
  onOpenSettingsAction: () => void;
  onUpdateWorkAction: (workId: string, title: string) => void;
  onDeleteWorkAction: (workId: string) => void;
  onUpdateVolumeAction: (volumeId: string, title: string) => void;
  onDeleteVolumeAction: (volumeId: string) => void;
  onDeleteChapterAction: (chapterId: string) => void;
  onUpdateChapterAction: (chapterId: string, title: string) => void;
  onOpenWorldviewAction: () => void;
}) {
  const [collapsedVolumes, setCollapsedVolumes] = useState<Record<string, boolean>>({});
  const [isWorkManagerOpen, setIsWorkManagerOpen] = useState(false);
  const [isVolumeManagerOpen, setIsVolumeManagerOpen] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingChapterTitle, setEditingChapterTitle] = useState('');
  const workSelectorRef = useRef<HTMLDivElement>(null);
  const volumeSelectorRef = useRef<HTMLDivElement>(null);

  const prevChapterCount = useRef(chapters.length);
  const autoEditTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (chapters.length > prevChapterCount.current) {
      const newChapter = chapters[chapters.length - 1];
      if (newChapter) {
        autoEditTimeoutRef.current = setTimeout(() => {
          setEditingChapterId(newChapter.id);
          setEditingChapterTitle(newChapter.title);
          setCollapsedVolumes(prev => ({ ...prev, [newChapter.volumeId]: false }));
        }, 0);
      }
    }
    prevChapterCount.current = chapters.length;

    return () => {
      if (autoEditTimeoutRef.current) {
        clearTimeout(autoEditTimeoutRef.current);
      }
    };
  }, [chapters]);

  const toggleVolume = (volumeId: string) => {
    setCollapsedVolumes(prev => ({ ...prev, [volumeId]: !prev[volumeId] }));
  };

  const activeWork = works.find((w) => w.id === activeWorkId);
  const chaptersByVolume = useMemo(() => {
    const grouped = new Map<string, ChapterRecord[]>();

    for (const volume of volumes) {
      grouped.set(volume.id, []);
    }

    for (const chapter of chapters) {
      const list = grouped.get(chapter.volumeId);
      if (list) {
        list.push(chapter);
      }
    }

    return grouped;
  }, [chapters, volumes]);

  void activeModel;
  void providers;

  return (
    <div className="flex flex-col h-full bg-muted/30 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

        <div className="space-y-2">
          <span className="text-mono-label px-2 text-muted-foreground/80">{copy.workManager}</span>
          <div ref={workSelectorRef} className="relative">
            <button
              onClick={() => setIsWorkManagerOpen(!isWorkManagerOpen)}
              className={cx(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                "bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)]",
                "hover:shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_4px_8px_rgba(0,0,0,0.08)]",
                "active:scale-[0.98]"
              )}
            >
              <span className="truncate">{activeWork?.title ?? '选择作品'}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={cx(
                  "transition-transform duration-200 shrink-0 ml-2",
                  isWorkManagerOpen ? "rotate-180" : ""
                )}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isWorkManagerOpen && (
              <WorkManagerPanel
                works={works}
                activeWorkId={activeWorkId}
                draftWorkTitle={draftWorkTitle}
                onWorkChange={onWorkChangeAction}
                onWorkTitleChange={onWorkTitleChangeAction}
                onCreateWork={onCreateWorkAction}
                onUpdateWork={onUpdateWorkAction}
                onDeleteWork={onDeleteWorkAction}
                onClose={() => setIsWorkManagerOpen(false)}
              />
            )}
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-muted-foreground/10">
          <div className="flex items-center justify-between px-2">
            <span className="text-mono-label text-muted-foreground/80">{copy.chapterManager}</span>
            <div ref={volumeSelectorRef} className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                onClick={() => setIsVolumeManagerOpen(!isVolumeManagerOpen)}
                title="管理卷"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9M12 20V4M12 20l-7-7M12 4l-7 7" />
                </svg>
              </Button>
              {isVolumeManagerOpen && (
                <VolumeManagerPanel
                  volumes={volumes}
                  chapters={chapters}
                  draftVolumeTitle={draftVolumeTitle}
                  onVolumeTitleChange={onVolumeTitleChangeAction}
                  onCreateVolume={onCreateVolumeAction}
                  onUpdateVolume={onUpdateVolumeAction}
                  onDeleteVolume={onDeleteVolumeAction}
                  onDeleteChapter={onDeleteChapterAction}
                  onClose={() => setIsVolumeManagerOpen(false)}
                />
              )}
            </div>
          </div>

          <div className="space-y-4">
            {volumes.map((volume) => {
              const isCollapsed = collapsedVolumes[volume.id];
              const volumeChapters = chaptersByVolume.get(volume.id) ?? [];

              return (
                <div key={volume.id} className="space-y-1">
                  <button
                    onClick={() => toggleVolume(volume.id)}
                    className="w-full px-2 flex items-center justify-between group cursor-pointer"
                  >
                    <span className="text-[11px] font-semibold text-foreground/85 uppercase tracking-[0.08em] group-hover:text-foreground transition-colors">
                      {volume.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground/60 group-hover:text-muted-foreground/80 transition-all">
                      {isCollapsed ? '+' : '−'}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-0.5 mt-1 animate-fade-in">
                      {volumeChapters.map((chapter) => (
                        <div
                          key={chapter.id}
                          className={cx(
                            "group flex items-center rounded-md transition-all duration-200",
                            chapter.id === activeChapterId
                              ? "bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]"
                              : "hover:bg-muted/50"
                          )}
                        >
                          {editingChapterId === chapter.id ? (
                            <div className="flex-1 flex items-center gap-1 px-2 py-1">
                              <Input
                                size={1}
                                value={editingChapterTitle}
                                onChange={(e) => setEditingChapterTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    if (editingChapterTitle.trim()) {
                                       onUpdateChapterAction(chapter.id, editingChapterTitle.trim());
                                    }
                                    setEditingChapterId(null);
                                    setEditingChapterTitle('');
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingChapterId(null);
                                    setEditingChapterTitle('');
                                  }
                                }}
                                onBlur={() => {
                                  if (editingChapterTitle.trim()) {
                                     onUpdateChapterAction(chapter.id, editingChapterTitle.trim());
                                  }
                                  setEditingChapterId(null);
                                  setEditingChapterTitle('');
                                }}
                                className="h-6 text-xs flex-1"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <>
                  <button
                     onClick={() => onChapterChangeAction(chapter.id)}
                    onDoubleClick={() => {
                      setEditingChapterId(chapter.id);
                      setEditingChapterTitle(chapter.title);
                    }}
                    className={cx(
                      "flex-1 text-left px-3 py-1.5 text-sm transition-all duration-200 active:scale-[0.98]",
                      chapter.id === activeChapterId
                        ? "text-foreground font-semibold"
                        : "text-foreground/75 hover:text-foreground"
                    )}
                  >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate">{chapter.title}</span>
                                  <span className="text-[10px] font-mono text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                                    {chapter.wordCount}
                                  </span>
                                </div>
                              </button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 mr-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`确定要删除章节 "${chapter.title}" 吗？此操作不可恢复。`)) {
                                     onDeleteChapterAction(chapter.id);
                                  }
                                }}
                                title="删除章节"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </Button>
                            </>
                          )}
                        </div>
                      ))}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-xs text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity"
                         onClick={() => onCreateChapterAction(volume.id)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        添加章节
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-none p-3 border-t border-muted-foreground/10 bg-muted/20 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenSettingsAction}
          className={cx(
            "w-full h-9 px-3 text-xs justify-start gap-2.5",
            "hover:bg-background/80 hover:text-foreground",
            "active:scale-[0.98] transition-all duration-200"
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-muted-foreground">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="flex-1 truncate text-left font-medium">
            {copy.modelSettings}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-muted-foreground/50">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenWorldviewAction}
          className={cx(
            "w-full h-9 px-3 text-xs justify-start gap-2.5",
            "hover:bg-background/80 hover:text-foreground",
            "active:scale-[0.98] transition-all duration-200"
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-muted-foreground">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <span className="flex-1 truncate text-left font-medium">
            世界观
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-muted-foreground/50">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
