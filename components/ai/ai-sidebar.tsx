import { Badge } from '../ui/badge';
import { Panel } from '../ui/panel';
import { ChatSessionList } from './chat-session-list';
import { ModelPicker } from './model-picker';

export function AiSidebar() {
  return (
    <Panel
      title="AI sidecar"
      subtitle="右栏 AI 面板收纳模型选择、会话列表与后续流式操作，不覆盖正文主舞台。"
      badge={<Badge tone="red">AI</Badge>}
    >
      <ModelPicker />
      <ChatSessionList />
    </Panel>
  );
}
