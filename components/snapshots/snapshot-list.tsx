import type { WorkspaceLocale } from '@/lib/contracts/workspace';
import { Button } from '../ui/button';
import { cx } from '@/lib/design/cx';

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
    <div className="space-y-3">
      {snapshots.map((snapshot) => (
        <div key={snapshot.id} className="p-3 rounded-lg border bg-background space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">{new Date(snapshot.createdAt).toLocaleString()}</span>
          </div>
          <p className="text-sm font-semibold">{snapshot.label}</p>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => onRestore(snapshot.id)}>
              Restore
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500" onClick={() => onDelete(snapshot.id)}>
              Delete
            </Button>
          </div>
        </div>
      ))}

      {auditLog.length > 0 && (
        <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
          <span className="text-[10px] uppercase text-muted-foreground font-semibold">Activity Log</span>
          <div className="space-y-1">
            {auditLog.map((entry, idx) => (
              <p key={idx} className="text-[10px] text-muted-foreground truncate font-mono">
                {entry}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
