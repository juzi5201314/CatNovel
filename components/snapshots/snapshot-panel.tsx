import { Badge } from '../ui/badge';
import { Panel } from '../ui/panel';
import { SnapshotActionBar } from './snapshot-action-bar';
import { SnapshotList } from './snapshot-list';

export function SnapshotPanel() {
  return (
    <Panel
      title="Snapshot lane"
      subtitle="快照入口固定在左栏，帮助用户在破坏性操作前建立稳定回滚心智。"
      badge={<Badge tone="neutral">Snapshots</Badge>}
    >
      <SnapshotActionBar />
      <SnapshotList />
    </Panel>
  );
}
