import type {
  ChatMessageRecord,
  ChatSessionRecord,
} from '@/lib/contracts/workspace';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { cx } from '@/lib/design/cx';

export function ChatSessionList({
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
    <div className="flex flex-col h-full bg-background" id="ai-sessions">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between px-2">
            <span className="text-mono-label">Sessions</span>
          </div>
          <div className="space-y-1">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSessionChange(session.id)}
                className={cx(
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                  session.id === activeSessionId
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                {session.title}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={cx(
                "flex flex-col gap-1 max-w-[90%]",
                message.role === 'user' ? "ml-auto items-end" : "items-start"
              )}>
                <div className={cx(
                  "px-3 py-2 rounded-2xl text-sm",
                  message.role === 'user' 
                    ? "bg-primary text-primary-foreground rounded-tr-none" 
                    : "bg-muted text-foreground rounded-tl-none"
                )}>
                  {message.body}
                </div>
                <span className="text-[10px] text-muted-foreground px-1 uppercase tracking-tighter">
                  {message.role} • {message.tokenCount}t
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t bg-muted/30 space-y-3">
        <Textarea
          value={draftPrompt}
          onChange={(e) => onDraftPromptChange(e.target.value)}
          placeholder="Message AI..."
          className="min-h-[80px] text-sm bg-background"
        />
        <div className="flex gap-2">
          <Input 
            value={draftTitle}
            onChange={(e) => onDraftTitleChange(e.target.value)}
            placeholder="New session title..."
            className="h-8 text-xs flex-1"
          />
          <Button variant="primary" size="sm" className="h-8" onClick={onSendPrompt}>Send</Button>
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={onCreateSession}>
          New Session
        </Button>
      </div>
    </div>
  );
}
