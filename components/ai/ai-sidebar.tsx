import type {
  ChatMessageRecord,
  ChatSessionRecord,
  ProviderProfileRecord,
  WorkspaceLocale,
} from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { Badge } from '../ui/badge';
import { Panel } from '../ui/panel';
import { ChatSessionList } from './chat-session-list';
import { ModelPicker } from './model-picker';

export function AiSidebar({
  locale,
  copy,
  workLabel,
  chapterTitle,
  providers,
  activeProfileId,
  modelDraft,
  sessions,
  activeSessionId,
  messages,
  sessionDraftTitle,
  freeChatPrompt,
  onSelectProfile,
  onModelDraftChange,
  onCreateProfile,
  onCreateSession,
  onSessionDraftTitleChange,
  onSessionChange,
  onFreeChatPromptChange,
  onSendFreeChat,
}: {
  locale: WorkspaceLocale;
  copy: AppMessages;
  workLabel: string;
  chapterTitle: string;
  providers: ProviderProfileRecord[];
  activeProfileId: string | null;
  modelDraft: {
    label: string;
    endpoint: string;
    models: string;
  };
  sessions: ChatSessionRecord[];
  activeSessionId: string | null;
  messages: ChatMessageRecord[];
  sessionDraftTitle: string;
  freeChatPrompt: string;
  onSelectProfile: (profileId: string) => void;
  onModelDraftChange: (
    field: 'label' | 'endpoint' | 'models',
    value: string,
  ) => void;
  onCreateProfile: () => void;
  onCreateSession: () => void;
  onSessionDraftTitleChange: (value: string) => void;
  onSessionChange: (sessionId: string) => void;
  onFreeChatPromptChange: (value: string) => void;
  onSendFreeChat: () => void;
}) {
  return (
    <Panel
      id="ai-panel"
      title={copy.aiSidebar}
      subtitle={`${workLabel} · ${chapterTitle} 的 AI sidecar：模型、会话、token usage 都落在 SQLite。`}
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
      <ModelPicker
        locale={locale}
        providers={providers}
        activeProfileId={activeProfileId}
        draftLabel={modelDraft.label}
        draftEndpoint={modelDraft.endpoint}
        draftModels={modelDraft.models}
        onSelectProfile={onSelectProfile}
        onDraftFieldChange={onModelDraftChange}
        onCreateProfile={onCreateProfile}
      />
      <ChatSessionList
        locale={locale}
        sessions={sessions}
        activeSessionId={activeSessionId}
        messages={messages}
        draftTitle={sessionDraftTitle}
        draftPrompt={freeChatPrompt}
        onCreateSession={onCreateSession}
        onDraftTitleChange={onSessionDraftTitleChange}
        onDraftPromptChange={onFreeChatPromptChange}
        onSessionChange={onSessionChange}
        onSendPrompt={onSendFreeChat}
      />
    </Panel>
  );
}
