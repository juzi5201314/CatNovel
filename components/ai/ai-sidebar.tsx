import type { AppMessages, SupportedLocale } from '../../lib/i18n/messages';

import { Badge } from '../ui/badge';
import { Panel } from '../ui/panel';
import { ChatSessionList } from './chat-session-list';
import { ModelPicker } from './model-picker';

export function AiSidebar({
  locale,
  copy,
  workLabel,
  chapterTitle,
}: {
  locale: SupportedLocale;
  copy: AppMessages;
  workLabel: string;
  chapterTitle: string;
}) {
  return (
    <Panel
      id="ai-panel"
      title={copy.aiSidebar}
      subtitle={`${workLabel} · ${chapterTitle} 的 AI sidecar，模型选择、会话列表与快照入口都保持在当前 route 下。`}
      badge={<Badge tone="red">AI</Badge>}
    >
      <div className="assistant-link-grid">
        <a className="button button--ghost button--anchor" href="#ai-models">
          Model picker
        </a>
        <a className="button button--ghost button--anchor" href="#ai-sessions">
          Chat sessions
        </a>
        <a className="button button--ghost button--anchor" href="#snapshot-panel">
          {copy.snapshots}
        </a>
      </div>
      <ModelPicker locale={locale} />
      <ChatSessionList locale={locale} />
    </Panel>
  );
}
