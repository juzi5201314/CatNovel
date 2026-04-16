import type {
  ChapterExportFormat,
  ImportFileFormat,
  ProjectExportFormat,
} from '@/lib/contracts/transfer';

import { Button } from '../ui/button';
import { Input } from '../ui/input';

const chapterExportOptions: ChapterExportFormat[] = ['md', 'docx', 'epub', 'pdf'];
const importFileOptions: ImportFileFormat[] = ['md', 'docx', 'pdf'];

export function SnapshotActionBar({
  draftLabel,
  onDraftLabelChange,
  onCreateSnapshot,
  onExportProject,
  onImportProject,
  onExportChapters,
  onParseImportFile,
}: {
  draftLabel: string;
  onDraftLabelChange: (value: string) => void;
  onCreateSnapshot: () => void;
  onExportProject: (format: ProjectExportFormat) => void;
  onImportProject: () => void;
  onExportChapters: (format: ChapterExportFormat) => void;
  onParseImportFile: (format: ImportFileFormat) => void;
}) {
  return (
    <div className="space-y-4 bg-muted/30 p-4 rounded-lg border">
      <div className="space-y-2">
        <span className="text-[10px] uppercase text-muted-foreground font-semibold">Label</span>
        <Input 
          value={draftLabel} 
          onChange={(event) => onDraftLabelChange(event.target.value)} 
          className="h-8 text-xs"
        />
        <Button variant="primary" size="sm" className="w-full h-8" onClick={onCreateSnapshot}>
          Create Snapshot
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
        <div className="space-y-1">
          <span className="text-[10px] uppercase text-muted-foreground font-semibold">Export</span>
          <div className="flex flex-wrap gap-1">
            {chapterExportOptions.map((format) => (
              <Button key={format} variant="outline" size="sm" className="h-6 text-[10px] uppercase px-1.5" onClick={() => onExportChapters(format)}>
                {format}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] uppercase text-muted-foreground font-semibold">Import</span>
          <div className="flex flex-wrap gap-1">
            {importFileOptions.map((format) => (
              <Button key={format} variant="outline" size="sm" className="h-6 text-[10px] uppercase px-1.5" onClick={() => onParseImportFile(format)}>
                {format}
              </Button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="flex gap-2 pt-2 border-t">
        <Button variant="ghost" size="sm" className="flex-1 h-7 text-[10px]" onClick={() => onExportProject('json')}>Export Project</Button>
        <Button variant="ghost" size="sm" className="flex-1 h-7 text-[10px]" onClick={onImportProject}>Import Project</Button>
      </div>
    </div>
  );
}
