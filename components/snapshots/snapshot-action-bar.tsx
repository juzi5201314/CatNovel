import type { AppMessages } from '../../lib/i18n/messages';

import { Button } from '../ui/button';

export function SnapshotActionBar({ copy }: { copy: AppMessages }) {
  return (
    <div className="snapshot-actions">
      <Button variant="primary">Create snapshot</Button>
      <Button variant="ghost">Restore selected</Button>
      <a className="button button--ghost button--anchor" href="#ai-panel">
        {copy.aiSidebar}
      </a>
    </div>
  );
}
