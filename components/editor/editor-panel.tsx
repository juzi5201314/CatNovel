import type { ChapterRecord } from '@/lib/contracts/workspace';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { cx } from '@/lib/design/cx';

export type EditorModes = {
  slash: boolean;
  bubble: boolean;
  highlight: boolean;
  pageBreak: boolean;
};

export function EditorPanel({
  chapter,
  body,
  draftTitle,
  editorModes,
  saveState,
  pendingGhostText,
  isSidebarOpen,
  onTitleChange,
  onBodyChange,
  onToggleMode,
  onAcceptGhostText,
  onRejectGhostText,
  onToggleSidebar,
}: {
  chapter: ChapterRecord | null;
  body: string;
  draftTitle: string;
  editorModes: EditorModes;
  saveState: string;
  pendingGhostText: string;
  isSidebarOpen: boolean;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onToggleMode: (mode: keyof EditorModes) => void;
  onAcceptGhostText: () => void;
  onRejectGhostText: () => void;
  onToggleSidebar: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-background animate-fade-in" id="editor-panel">
      <div className="border-b px-4 py-4 flex items-center gap-3 bg-background sticky top-0 z-10">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 border border-border shadow-sm shrink-0 flex items-center justify-center"
          onClick={onToggleSidebar}
          title={isSidebarOpen ? '收起侧边栏' : '展开侧边栏'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            {isSidebarOpen ? (
              <>
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M9 4v16" />
                <path d="m14 10-3 3 3 3" />
              </>
            ) : (
              <>
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M9 4v16" />
                <path d="m10 10 3 3-3 3" />
              </>
            )}
          </svg>
        </Button>
        <div className="flex-1">
          <Input
            value={draftTitle}
            onChange={(event) => onTitleChange(event.target.value)}
            className="text-card-title bg-transparent shadow-none px-0 focus:shadow-none hover:bg-accent/50 transition-colors border-none"
            placeholder="Chapter Title"
          />
        </div>
        <div className="flex items-center gap-4">
          <Badge tone="neutral" pulse={saveState === 'autosaving' || saveState === 'saving'} className="font-mono text-[10px] uppercase tracking-tighter">
            {saveState === 'autosaving' ? 'Saving...' : saveState === 'saving' ? 'Saving...' : saveState}
          </Badge>
          <div className="flex items-center gap-1">
             <Button variant="ghost" size="sm" onClick={() => onToggleMode('highlight')} className={cx("h-8 px-2 text-xs", editorModes.highlight ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}>
               Highlight
             </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-12 py-8 md:px-16 md:py-10 lg:px-20 lg:py-12 overflow-y-auto">
        <div className="max-w-none space-y-12">
           <div className="grid grid-cols-4 gap-8 border-b pb-8">
              <div className="space-y-1">
                <span className="text-mono-label opacity-50">Words</span>
                <p className="text-2xl font-semibold tracking-tight">{chapter?.wordCount ?? 0}</p>
              </div>
              <div className="space-y-1">
                <span className="text-mono-label opacity-50">Chars</span>
                <p className="text-2xl font-semibold tracking-tight">{chapter?.characterCount ?? 0}</p>
              </div>
              <div className="space-y-1">
                <span className="text-mono-label opacity-50">Reading</span>
                <p className="text-2xl font-semibold tracking-tight">{chapter?.readingMinutes ?? 0}m</p>
              </div>
              <div className="space-y-1">
                <span className="text-mono-label opacity-50">Saved</span>
                <p className="text-[10px] text-muted-foreground font-mono mt-2 truncate">{chapter?.lastAutosavedAt?.split('T')[1].split('.')[0] ?? '—'}</p>
              </div>
           </div>

           <div className="relative group">
            <Textarea
              className="min-h-[70vh] text-lg leading-relaxed bg-transparent shadow-none border-none p-0 focus:shadow-none resize-none placeholder:text-muted-foreground/30"
              value={body}
              onChange={(event) => onBodyChange(event.target.value)}
              placeholder="Start writing your masterpiece..."
            />
            
            {saveState.startsWith('ai:') && (
              <div className="absolute inset-0 bg-background/5 pointer-events-none flex items-end py-12">
                <div className="w-full h-24 bg-accent/20 animate-pulse-subtle rounded-lg border border-accent/30 border-dashed" />
              </div>
            )}
           </div>

           {pendingGhostText && (
             <Card className="border-accent/30 bg-accent/5 mt-12 shadow-none animate-fade-in">
               <CardHeader className="py-3 border-b border-accent/20">
                 <CardTitle className="text-[10px] uppercase tracking-[0.2em] font-bold text-accent-foreground/50">Ghost AI Suggestion</CardTitle>
               </CardHeader>
               <CardContent className="py-6 space-y-6">
                 <p className="text-muted-foreground italic leading-relaxed">{pendingGhostText}</p>
                 <div className="flex gap-3">
                   <Button variant="primary" size="sm" className="h-8 px-4 text-xs" onClick={onAcceptGhostText}>Accept Change</Button>
                   <Button variant="outline" size="sm" className="h-8 px-4 text-xs" onClick={onRejectGhostText}>Discard</Button>
                 </div>
               </CardContent>
             </Card>
           )}
        </div>
      </div>

    </div>
  );
}
