import type {
  ChatMessageRecord,
  ChatSessionRecord,
  WorkspaceLocale,
} from '@/lib/contracts/workspace';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { SectionLabel } from '../ui/section-label';
import { Textarea } from '../ui/textarea';

export function ChatSessionList({
  locale,
  sessions,
  activeSessionId,
  messages,
  draftTitle,
  draftPrompt,
  onCreateSession,
  onDraftTitleChange,
  onDraftPromptChange,
  onSessionChange,
  onSendPrompt,
}: {
  locale: WorkspaceLocale;
  sessions: ChatSessionRecord[];
  activeSessionId: string | null;
  messages: ChatMessageRecord[];
  draftTitle: string;
  draftPrompt: string;
  onCreateSession: () => void;
  onDraftTitleChange: (value: string) => void;
  onDraftPromptChange: (value: string) => void;
  onSessionChange: (sessionId: string) => void;
  onSendPrompt: () => void;
}) {
  return (
    <div className="chat-session-list" id="ai-sessions">
      <article className="chat-session-card">
        <SectionLabel>
          {locale === 'zh' ? '新会话' : locale === 'en' ? 'New session' : 'Новая сессия'}
        </SectionLabel>
        <Input
          value={draftTitle}
          onChange={(event) => onDraftTitleChange(event.target.value)}
          placeholder={locale === 'zh' ? '自由对话标题' : locale === 'en' ? 'Session title' : 'Название сессии'}
        />
        <Button variant="ghost" onClick={onCreateSession}>
          {locale === 'zh' ? '创建会话' : locale === 'en' ? 'Create session' : 'Создать сессию'}
        </Button>
      </article>

      {sessions.map((session, index) => (
        <article key={session.id} className="chat-session-card">
          <div className="meta-row">
            <SectionLabel>{`Session 0${index + 1}`}</SectionLabel>
            <Badge tone="neutral">{session.updatedAt}</Badge>
          </div>
          <strong>{session.title}</strong>
          <Button variant="ghost" onClick={() => onSessionChange(session.id)}>
            {session.id === activeSessionId
              ? locale === 'zh'
                ? '当前会话'
                : locale === 'en'
                  ? 'Active'
                  : 'Активно'
              : locale === 'zh'
                ? '切换'
                : locale === 'en'
                  ? 'Open'
                  : 'Открыть'}
          </Button>
        </article>
      ))}

      <article className="chat-session-card">
        <SectionLabel>
          {locale === 'zh' ? '自由对话' : locale === 'en' ? 'Free chat' : 'Свободный чат'}
        </SectionLabel>
        <div className="task-stack">
          {messages.map((message) => (
            <div key={message.id} className="nav-item">
              <div className="meta-row">
                <strong>{message.role}</strong>
                <Badge tone="neutral">{message.tokenCount}</Badge>
              </div>
              <p>{message.body}</p>
            </div>
          ))}
        </div>
        <Textarea
          rows={4}
          value={draftPrompt}
          onChange={(event) => onDraftPromptChange(event.target.value)}
          placeholder={locale === 'zh' ? '问 AI 一个问题…' : locale === 'en' ? 'Ask the AI…' : 'Спросите AI…'}
        />
        <Button variant="ghost" onClick={onSendPrompt}>
          {locale === 'zh' ? '发送自由对话' : locale === 'en' ? 'Send free chat' : 'Отправить'}
        </Button>
      </article>
    </div>
  );
}
