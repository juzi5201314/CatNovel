import type {
  ActiveModelSelection,
  ChatMessageRecord,
  ChatSessionRecord,
  ProviderProfileRecord,
} from '@/lib/contracts/workspace';
import type { AgentRunStatus } from '@/lib/contracts/agent-events';

import { ChatSessionList } from './chat-session-list';
import type { StreamingMessage, ToolCallItem } from './chat-session-list';

export function AiSidebar({
  providers,
  activeModel,
  sessions,
  activeSessionId,
  messages,
  agentStatus,
  activeToolName,
  streamingMessage,
  toolCalls,
  draftPrompt,
  onOpenSettings,
  onCreateSession,
  onDeleteSession,
  onSessionChange,
  onDraftPromptChange,
  onSendPrompt,
  onRetryMessage,
  onDeleteMessage,
}: {
  providers: ProviderProfileRecord[];
  activeModel: ActiveModelSelection | null;
  sessions: ChatSessionRecord[];
  activeSessionId: string | null;
  messages: ChatMessageRecord[];
  agentStatus: AgentRunStatus;
  activeToolName: string | null;
  streamingMessage: StreamingMessage | null;
  toolCalls: ToolCallItem[];
  draftPrompt: string;
  onOpenSettings: () => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onSessionChange: (sessionId: string) => void;
  onDraftPromptChange: (value: string) => void;
  onSendPrompt: () => void;
  onRetryMessage: (messageId: string) => void;
  onDeleteMessage: (messageId: string) => void;
}) {
  return (
    <div className="flex flex-col h-full animate-fade-in" id="ai-panel">
      <div className="flex-1 overflow-y-auto">
        <ChatSessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          messages={messages}
          draftPrompt={draftPrompt}
          agentStatus={agentStatus}
          activeToolName={activeToolName}
          streamingMessage={streamingMessage}
          toolCalls={toolCalls}
          providers={providers}
          activeModel={activeModel}
          onCreateSession={onCreateSession}
          onDeleteSession={onDeleteSession}
          onSessionChange={onSessionChange}
          onDraftPromptChange={onDraftPromptChange}
          onSendPrompt={onSendPrompt}
          onRetryMessage={onRetryMessage}
          onDeleteMessage={onDeleteMessage}
          onOpenModelSettings={onOpenSettings}
        />
      </div>
    </div>
  );
}
