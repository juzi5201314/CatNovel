import type {
  ActiveModelSelection,
  ChatMessageRecord,
  ChatSessionRecord,
  ProviderProfileRecord,
} from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { ChatSessionList } from './chat-session-list';

export function AiSidebar({
  copy,
  providers,
  activeModel,
  sessions,
  activeSessionId,
  messages,
  sessionDraftTitle,
  freeChatPrompt,
  onOpenSettings,
  onCreateSession,
  onSessionDraftTitleChange,
  onSessionChange,
  onFreeChatPromptChange,
  onSendFreeChat,
}: {
  copy: AppMessages;
  providers: ProviderProfileRecord[];
  activeModel: ActiveModelSelection | null;
  sessions: ChatSessionRecord[];
  activeSessionId: string | null;
  messages: ChatMessageRecord[];
  sessionDraftTitle: string;
  freeChatPrompt: string;
  onOpenSettings: () => void;
  onCreateSession: () => void;
  onSessionDraftTitleChange: (value: string) => void;
  onSessionChange: (sessionId: string) => void;
  onFreeChatPromptChange: (value: string) => void;
  onSendFreeChat: () => void;
}) {
  const activeModelLabel = activeModel
    ? (() => {
        const profile = providers.find((p) => p.id === activeModel.profileId);
        return profile ? `${profile.label}/${activeModel.modelId}` : activeModel.modelId;
      })()
    : '—';

  return (
    <div className="flex flex-col h-full animate-fade-in" id="ai-panel">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors max-w-[180px]"
          title={copy.modelSettings}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
            <circle cx="8" cy="8" r="2.5" />
            <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
          </svg>
          <span className="truncate">{activeModelLabel}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ChatSessionList
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
      </div>
    </div>
  );
}
