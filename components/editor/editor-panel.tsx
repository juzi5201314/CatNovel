import type { ChapterRecord, WorkspaceLocale } from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { slashCommands, t } from '../workspace/workspace-data';
import { cx } from '@/lib/design/cx';

export type EditorModes = {
  slash: boolean;
  bubble: boolean;
  highlight: boolean;
  pageBreak: boolean;
};

export function EditorPanel({
  locale,
  copy,
  chapter,
  body,
  draftTitle,
  editorModes,
  saveState,
  pendingGhostText,
  onTitleChange,
  onBodyChange,
  onToggleMode,
  onRunTask,
  onAcceptGhostText,
  onRejectGhostText,
}: {
  locale: WorkspaceLocale;
  copy: AppMessages;
  chapter: ChapterRecord | null;
  body: string;
  draftTitle: string;
  editorModes: EditorModes;
  saveState: string;
  pendingGhostText: string;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onToggleMode: (mode: keyof EditorModes) => void;
  onRunTask: (taskClass: '续写' | '改写' | '润色' | '扩写' | 'ghost-text') => void;
  onAcceptGhostText: () => void;
  onRejectGhostText: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-background animate-fade-in" id="editor-panel">
      <div className="border-b px-6 py-4 flex items-center justify-between bg-background sticky top-0 z-10">
        <div className="flex-1 max-w-2xl">
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

      <div className="flex-1 p-6 md:p-12 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-12">
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

      <div className="border-t p-4 bg-background/80 backdrop-blur-sm sticky bottom-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
             {slashCommands.map((command) => (
                <Button 
                  key={command.id} 
                  variant="outline" 
                  size="sm"
                  className="h-8 px-3 text-xs whitespace-nowrap border-muted-foreground/10 hover:border-muted-foreground/30 transition-all"
                  onClick={() => onRunTask(command.id as any)}
                >
                  {t(locale, command.label)}
                </Button>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}
