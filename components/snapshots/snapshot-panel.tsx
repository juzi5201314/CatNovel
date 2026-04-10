import type { AppMessages, SupportedLocale } from '@/lib/i18n/messages';

import { Badge } from '../ui/badge';
import { Panel } from '../ui/panel';
import { SnapshotActionBar } from './snapshot-action-bar';
import { SnapshotList } from './snapshot-list';

export function SnapshotPanel({
  locale,
  copy,
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
  locale: SupportedLocale;
  copy: AppMessages;
  snapshots: Array<{ id: string; label: string; createdAt: string }>;
  draftLabel: string;
  auditLog: string[];
  onDraftLabelChange: (value: string) => void;
  onCreateSnapshot: () => void;
  onRestoreSnapshot: (snapshotId: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onExportProject: (format: 'json' | 'txt' | 'md' | 'docx' | 'epub' | 'pdf') => void;
  onImportProject: () => void;
  onExportChapters: (format: 'txt' | 'md' | 'docx' | 'epub' | 'pdf') => void;
  onParseImportFile: (format: 'txt' | 'md' | 'epub' | 'docx' | 'doc' | 'pdf') => void;
}) {
  return (
    <Panel
      id="snapshot-panel"
      title={copy.snapshots}
      subtitle="快照、导入、导出与恢复演练都直接挂在当前路由。"
      badge={<Badge tone="neutral">Snapshots</Badge>}
    >
      <SnapshotActionBar
        copy={copy}
        draftLabel={draftLabel}
        onDraftLabelChange={onDraftLabelChange}
        onCreateSnapshot={onCreateSnapshot}
        onExportProject={onExportProject}
        onImportProject={onImportProject}
        onExportChapters={onExportChapters}
        onParseImportFile={onParseImportFile}
      />
      <SnapshotList
        locale={locale}
        snapshots={snapshots}
        auditLog={auditLog}
        onRestore={onRestoreSnapshot}
        onDelete={onDeleteSnapshot}
      />
    </Panel>
  );
}
