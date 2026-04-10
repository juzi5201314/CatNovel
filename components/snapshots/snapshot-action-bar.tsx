import type { AppMessages } from '@/lib/i18n/messages';

import { Button } from '../ui/button';
import { Input } from '../ui/input';

export function SnapshotActionBar({
  copy,
  draftLabel,
  onDraftLabelChange,
  onCreateSnapshot,
  onExportProject,
  onImportProject,
  onExportChapters,
  onParseImportFile,
}: {
  copy: AppMessages;
  draftLabel: string;
  onDraftLabelChange: (value: string) => void;
  onCreateSnapshot: () => void;
  onExportProject: (format: 'json' | 'txt' | 'md' | 'docx' | 'epub' | 'pdf') => void;
  onImportProject: () => void;
  onExportChapters: (format: 'txt' | 'md' | 'docx' | 'epub' | 'pdf') => void;
  onParseImportFile: (format: 'txt' | 'md' | 'epub' | 'docx' | 'doc' | 'pdf') => void;
}) {
  return (
    <div className="task-stack">
      <Input value={draftLabel} onChange={(event) => onDraftLabelChange(event.target.value)} />
      <div className="snapshot-actions">
        <Button variant="primary" onClick={onCreateSnapshot}>
          Create snapshot
        </Button>
        <Button variant="ghost" onClick={() => onExportProject('json')}>
          Export JSON
        </Button>
        <Button variant="ghost" onClick={onImportProject}>
          Import JSON
        </Button>
      </div>
      <div className="snapshot-actions">
        <Button variant="ghost" onClick={() => onParseImportFile('txt')}>
          TXT import
        </Button>
        <Button variant="ghost" onClick={() => onParseImportFile('md')}>
          MD import
        </Button>
        <Button variant="ghost" onClick={() => onParseImportFile('epub')}>
          EPUB import
        </Button>
      </div>
      <div className="snapshot-actions">
        <Button variant="ghost" onClick={() => onParseImportFile('docx')}>
          DOCX import
        </Button>
        <Button variant="ghost" onClick={() => onParseImportFile('doc')}>
          DOC import
        </Button>
        <Button variant="ghost" onClick={() => onParseImportFile('pdf')}>
          PDF import
        </Button>
      </div>
      <div className="snapshot-actions">
        <Button variant="ghost" onClick={() => onExportChapters('txt')}>
          TXT export
        </Button>
        <Button variant="ghost" onClick={() => onExportChapters('md')}>
          MD export
        </Button>
        <Button variant="ghost" onClick={() => onExportChapters('docx')}>
          DOCX export
        </Button>
        <Button variant="ghost" onClick={() => onExportChapters('epub')}>
          EPUB export
        </Button>
        <Button variant="ghost" onClick={() => onExportChapters('pdf')}>
          PDF export
        </Button>
      </div>
      <a className="button button--ghost button--anchor" href="#ai-panel">
        {copy.aiSidebar}
      </a>
    </div>
  );
}
