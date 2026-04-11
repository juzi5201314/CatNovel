import type {
  ChatMessageRecord,
  ChatSessionRecord,
  ProviderProfileRecord,
  WorkspaceLocale,
} from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { Badge } from '../ui/badge';
import { ChatSessionList } from './chat-session-list';
import { ModelPicker } from './model-picker';
import { Button } from '../ui/button';

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
    <div className="flex flex-col h-full animate-fade-in" id="ai-panel">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <span className="text-mono-label">{copy.aiSidebar}</span>
           <Badge tone="red" className="text-[10px] px-1.5 py-0">LIVE</Badge>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
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
        
        <div className="border-t">
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
        </div>
      </div>
    </div>
  );
}
