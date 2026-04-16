import type {
  BookMetadataRecord,
  SettingNodeRecord,
} from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { cx } from '@/lib/design/cx';

export function SettingsPanel({
  copy,
  nodes,
  activeNodeId,
  activeNodeTitle,
  activeNodeSummary,
  draftNodeTitle,
  metadata,
  onNodeChange,
  onDraftNodeTitleChange,
  onCreateNode,
  onActiveNodeTitleChange,
  onActiveNodeSummaryChange,
  onSaveNode,
  onDeleteNode,
  onMetadataChange,
  onSaveMetadata,
}: {
  copy: AppMessages;
  nodes: SettingNodeRecord[];
  activeNodeId: string | null;
  activeNodeTitle: string;
  activeNodeSummary: string;
  draftNodeTitle: string;
  metadata: BookMetadataRecord | null;
  onNodeChange: (id: string) => void;
  onDraftNodeTitleChange: (value: string) => void;
  onCreateNode: () => void;
  onActiveNodeTitleChange: (value: string) => void;
  onActiveNodeSummaryChange: (value: string) => void;
  onSaveNode: () => void;
  onDeleteNode: () => void;
  onMetadataChange: (
    field: keyof Omit<BookMetadataRecord, 'workId' | 'updatedAt'>,
    value: string,
  ) => void;
  onSaveMetadata: () => void;
}) {
  return (
    <div className="flex flex-col h-full animate-fade-in space-y-6 p-4">
      <div className="space-y-4">
        <span className="text-mono-label px-2">{copy.bookInfo}</span>
        <div className="space-y-3 bg-muted/30 p-4 rounded-lg border">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold">Author</span>
              <Input 
                value={metadata?.authorName ?? ''} 
                onChange={(e) => onMetadataChange('authorName', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold">Status</span>
              <Input 
                value={metadata?.serializedStatus ?? ''} 
                onChange={(e) => onMetadataChange('serializedStatus', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
             <span className="text-[10px] uppercase text-muted-foreground font-semibold">Premise</span>
             <Textarea 
               value={metadata?.premise ?? ''} 
               onChange={(e) => onMetadataChange('premise', e.target.value)}
               className="text-xs min-h-[60px]"
             />
          </div>
          <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={onSaveMetadata}>
            Update Metadata
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <span className="text-mono-label px-2">{copy.settingsTree}</span>
        <div className="flex gap-2 px-2 overflow-x-auto pb-2">
           {nodes.map((node) => (
             <button
               key={node.id}
               onClick={() => onNodeChange(node.id)}
               className={cx(
                 "whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                 node.id === activeNodeId 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "bg-background text-muted-foreground hover:bg-muted"
               )}
             >
               {node.title}
             </button>
           ))}
        </div>

        {activeNodeId && (
          <div className="space-y-3 bg-muted/30 p-4 rounded-lg border animate-fade-in">
             <Input 
               value={activeNodeTitle} 
               onChange={(e) => onActiveNodeTitleChange(e.target.value)}
               className="h-8 font-semibold"
             />
             <Textarea 
               value={activeNodeSummary} 
               onChange={(e) => onActiveNodeSummaryChange(e.target.value)}
               className="text-xs min-h-[100px]"
             />
             <div className="flex gap-2">
               <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={onSaveNode}>Save</Button>
               <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500" onClick={onDeleteNode}>Delete</Button>
             </div>
          </div>
        )}

        <div className="pt-2 border-t px-2 space-y-2">
           <Input 
             value={draftNodeTitle} 
             onChange={(e) => onDraftNodeTitleChange(e.target.value)}
             placeholder="New setting node..."
             className="h-8 text-xs"
           />
           <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={onCreateNode}>
             Create Node
           </Button>
        </div>
      </div>
    </div>
  );
}
