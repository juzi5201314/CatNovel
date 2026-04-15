import { useState } from 'react';
import type {
  ActiveModelSelection,
  ChapterRecord,
  ProviderProfileRecord,
  VolumeRecord,
  WorkRecord,
  WorkspaceLocale,
} from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cx } from '@/lib/design/cx';

export function SidebarNav({
  copy,
  locale,
  works,
  volumes,
  chapters,
  activeWorkId,
  activeChapterId,
  draftWorkTitle,
  draftVolumeTitle,
  draftChapterTitle,
  activeModel,
  providers,
  onWorkTitleChange,
  onVolumeTitleChange,
  onChapterTitleChange,
  onWorkChange,
  onChapterChange,
  onCreateWork,
  onCreateVolume,
  onCreateChapter,
  onOpenSettings,
}: {
  copy: AppMessages;
  locale: WorkspaceLocale;
  works: WorkRecord[];
  volumes: VolumeRecord[];
  chapters: ChapterRecord[];
  activeWorkId: string;
  activeChapterId: string;
  draftWorkTitle: string;
  draftVolumeTitle: string;
  draftChapterTitle: string;
  activeModel: ActiveModelSelection | null;
  providers: ProviderProfileRecord[];
  onWorkTitleChange: (value: string) => void;
  onVolumeTitleChange: (value: string) => void;
  onChapterTitleChange: (value: string) => void;
  onWorkChange: (workId: string) => void;
  onChapterChange: (chapterId: string) => void;
  onCreateWork: () => void;
  onCreateVolume: () => void;
  onCreateChapter: () => void;
  onOpenSettings: () => void;
}) {
  const [collapsedVolumes, setCollapsedVolumes] = useState<Record<string, boolean>>({});

  const toggleVolume = (volumeId: string) => {
    setCollapsedVolumes(prev => ({ ...prev, [volumeId]: !prev[volumeId] }));
  };

  return (
    <div className="flex flex-col h-full bg-muted/30 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <div className="space-y-2">
          <span className="text-mono-label px-2 opacity-50">{copy.workManager}</span>
          <div className="space-y-1">
            {works.map((work) => (
              <button
                key={work.id}
                onClick={() => onWorkChange(work.id)}
                className={cx(
                  "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.98]",
                  work.id === activeWorkId 
                    ? "bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)] text-foreground" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {work.title}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-muted-foreground/10">
          <span className="text-mono-label px-2 opacity-50">{copy.chapterManager}</span>
          
          <div className="space-y-4">
            {volumes.map((volume) => {
              const isCollapsed = collapsedVolumes[volume.id];
              const volumeChapters = chapters.filter((c) => c.volumeId === volume.id);
              
              return (
                <div key={volume.id} className="space-y-1">
                  <button 
                    onClick={() => toggleVolume(volume.id)}
                    className="w-full px-2 flex items-center justify-between group cursor-pointer"
                  >
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em] group-hover:text-foreground transition-colors">
                      {volume.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground/40 group-hover:text-muted-foreground transition-all">
                      {isCollapsed ? '+' : '−'}
                    </span>
                  </button>
                  
                  {!isCollapsed && (
                    <div className="space-y-0.5 mt-1 animate-fade-in">
                      {volumeChapters.map((chapter) => (
                          <button
                            key={chapter.id}
                            onClick={() => onChapterChange(chapter.id)}
                            className={cx(
                              "w-full text-left px-3 py-1.5 rounded-md text-sm transition-all duration-200 active:scale-[0.98] group",
                              chapter.id === activeChapterId
                                ? "bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] text-foreground font-medium"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{chapter.title}</span>
                              <span className="text-[9px] font-mono opacity-40 group-hover:opacity-100 transition-opacity">
                                {chapter.wordCount}
                              </span>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-none p-4 border-t border-muted-foreground/10 bg-background/50 backdrop-blur-sm space-y-2">
         <Input
           size={1}
           value={draftChapterTitle}
           onChange={(e) => onChapterTitleChange(e.target.value)}
           placeholder="New chapter..."
           className="h-8 text-xs bg-background/50"
         />
         <div className="flex gap-2">
           <Button variant="outline" size="sm" className="flex-1 h-8 text-xs shadow-none border-muted-foreground/10 hover:border-muted-foreground/30 active:scale-[0.98]" onClick={onCreateChapter}>
              Add Chapter
           </Button>
           <Button
             variant="ghost"
             size="sm"
             className="h-8 w-8 p-0 shrink-0"
             onClick={onOpenSettings}
             title={copy.modelSettings}
           >
             <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
               <circle cx="8" cy="8" r="2.5" />
               <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
             </svg>
           </Button>
         </div>
      </div>

      <div className="flex-none p-3 border-t border-muted-foreground/10 bg-muted/20">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenSettings}
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
            {activeModel ? (() => {
              const profile = providers.find((p) => p.id === activeModel.profileId);
              return profile ? `${profile.label} / ${activeModel.modelId}` : copy.modelSettings;
            })() : copy.modelSettings}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-muted-foreground/50">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
