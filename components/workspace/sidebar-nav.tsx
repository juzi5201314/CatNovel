import { useState } from 'react';
import type {
  ChapterRecord,
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
  onWorkTitleChange,
  onVolumeTitleChange,
  onChapterTitleChange,
  onWorkChange,
  onChapterChange,
  onCreateWork,
  onCreateVolume,
  onCreateChapter,
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
  onWorkTitleChange: (value: string) => void;
  onVolumeTitleChange: (value: string) => void;
  onChapterTitleChange: (value: string) => void;
  onWorkChange: (workId: string) => void;
  onChapterChange: (chapterId: string) => void;
  onCreateWork: () => void;
  onCreateVolume: () => void;
  onCreateChapter: () => void;
}) {
  const [collapsedVolumes, setCollapsedVolumes] = useState<Record<string, boolean>>({});

  const toggleVolume = (volumeId: string) => {
    setCollapsedVolumes(prev => ({ ...prev, [volumeId]: !prev[volumeId] }));
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <div className="p-4 space-y-4">
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

      <div className="mt-auto p-4 border-t border-muted-foreground/10 bg-background/50 backdrop-blur-sm space-y-2">
         <Input 
           size={1}
           value={draftChapterTitle} 
           onChange={(e) => onChapterTitleChange(e.target.value)}
           placeholder="New chapter..."
           className="h-8 text-xs bg-background/50"
         />
         <Button variant="outline" size="sm" className="w-full h-8 text-xs shadow-none border-muted-foreground/10 hover:border-muted-foreground/30 active:scale-[0.98]" onClick={onCreateChapter}>
            Add Chapter
         </Button>
      </div>
    </div>
  );
}
