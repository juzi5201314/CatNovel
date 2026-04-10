import { Button } from '../ui/button';

export function SnapshotActionBar() {
  return (
    <div className="snapshot-actions">
      <Button variant="primary">Create snapshot</Button>
      <Button variant="ghost">Restore selected</Button>
      <Button variant="ghost">Export audit log</Button>
    </div>
  );
}
