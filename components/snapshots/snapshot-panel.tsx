import type { AppMessages, SupportedLocale } from '../../lib/i18n/messages';

import { Badge } from '../ui/badge';
import { Panel } from '../ui/panel';
import { SnapshotActionBar } from './snapshot-action-bar';
import { SnapshotList } from './snapshot-list';

export function SnapshotPanel({
  locale,
  copy,
  chapterTitle,
}: {
  locale: SupportedLocale;
  copy: AppMessages;
  chapterTitle: string;
}) {
  return (
    <Panel
      id="snapshot-panel"
      title={copy.snapshots}
      subtitle="快照入口固定在左栏，并与 AI / editor 共享当前 route 的锚点导航。"
      badge={<Badge tone="neutral">Snapshots</Badge>}
    >
      <SnapshotActionBar copy={copy} />
      <SnapshotList chapterTitle={chapterTitle} locale={locale} />
    </Panel>
  );
}
