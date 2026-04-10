import { WorkspaceShell } from '@/components/workspace/workspace-shell';
import { loadBootstrapPayload } from '@/lib/server/bootstrap';
import { listSnapshots } from '@/lib/server/snapshots';
import { getPersistenceSnapshot } from '@/lib/server/services/workspace-data-service';

function toClientState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default function WorkspacePage() {
  const bootstrap = toClientState(loadBootstrapPayload());
  const collections = toClientState(
    getPersistenceSnapshot({ workId: bootstrap.workspace.workId }),
  );
  const initialSnapshots = toClientState(listSnapshots(bootstrap.workspace.workId));

  return (
    <WorkspaceShell
      initialBootstrap={bootstrap}
      initialCollections={collections}
      initialSnapshots={initialSnapshots}
    />
  );
}
