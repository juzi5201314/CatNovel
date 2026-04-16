import type {
  ChapterExportFormat,
  ImportFileFormat,
  ProjectExportFormat,
} from '@/lib/contracts/transfer';

import { SnapshotActionBar } from './snapshot-action-bar';
import { SnapshotList } from './snapshot-list';

export function SnapshotPanel({
  snapshots,
  draftLabel,
  auditLog,
  onDraftLabelChange,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onExportProject,
  onImportProject,
  onExportChapters,
  onParseImportFile,
}: {
  snapshots: Array<{ id: string; label: string; createdAt: string }>;
  draftLabel: string;
  auditLog: string[];
  onDraftLabelChange: (value: string) => void;
  onCreateSnapshot: () => void;
  onRestoreSnapshot: (snapshotId: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onExportProject: (format: ProjectExportFormat) => void;
  onImportProject: () => void;
  onExportChapters: (format: ChapterExportFormat) => void;
  onParseImportFile: (format: ImportFileFormat) => void;
}) {
  return (
    <div className="flex flex-col h-full animate-fade-in p-4 space-y-6" id="snapshot-panel">
      <div className="space-y-4">
        <span className="text-mono-label px-2">Snapshot Actions</span>
        <SnapshotActionBar
          draftLabel={draftLabel}
          onDraftLabelChange={onDraftLabelChange}
          onCreateSnapshot={onCreateSnapshot}
          onExportProject={onExportProject}
          onImportProject={onImportProject}
          onExportChapters={onExportChapters}
          onParseImportFile={onParseImportFile}
        />
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-4">
        <span className="text-mono-label px-2">History</span>
        <SnapshotList
          snapshots={snapshots}
          auditLog={auditLog}
          onRestore={onRestoreSnapshot}
          onDelete={onDeleteSnapshot}
        />
      </div>
    </div>
  );
}
