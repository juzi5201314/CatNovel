import type { WorkspaceLocale } from '@/lib/contracts/workspace';

import { Button } from '../ui/button';
import { SectionLabel } from '../ui/section-label';

export function SnapshotList({
  locale,
  snapshots,
  auditLog,
  onRestore,
  onDelete,
}: {
  locale: WorkspaceLocale;
  snapshots: Array<{ id: string; label: string; createdAt: string }>;
  auditLog: string[];
  onRestore: (snapshotId: string) => void;
  onDelete: (snapshotId: string) => void;
}) {
  return (
    <div className="snapshot-list">
      {snapshots.map((snapshot) => (
        <article key={snapshot.id} className="snapshot-card">
          <SectionLabel>{snapshot.createdAt}</SectionLabel>
          <strong>{snapshot.label}</strong>
          <div className="snapshot-actions">
            <Button variant="ghost" onClick={() => onRestore(snapshot.id)}>
              {locale === 'zh' ? '恢复' : locale === 'en' ? 'Restore' : 'Восстановить'}
            </Button>
            <Button variant="ghost" onClick={() => onDelete(snapshot.id)}>
              {locale === 'zh' ? '删除' : locale === 'en' ? 'Delete' : 'Удалить'}
            </Button>
          </div>
        </article>
      ))}

      <article className="snapshot-card">
        <SectionLabel>
          {locale === 'zh' ? '导入 / 导出审计' : locale === 'en' ? 'Import/export audit' : 'Аудит импорта/экспорта'}
        </SectionLabel>
        <div className="task-stack">
          {auditLog.map((entry) => (
            <p key={entry}>{entry}</p>
          ))}
        </div>
      </article>
    </div>
  );
}
