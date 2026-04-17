'use client';

import type {
  ChatMessageRecord,
  ChatSessionRecord,
} from '@/lib/contracts/workspace';
import type { AgentRunStatus } from '@/lib/contracts/agent-events';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { AgentModeToggle } from './agent-mode-toggle';
import { AgentToolCall } from './agent-tool-call';
import { AgentStatusIndicator } from './agent-status-indicator';
import { cx } from '@/lib/design/cx';

export type ToolCallItem = {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status: 'running' | 'success' | 'error';
  result?: unknown;
  error?: string;
};

export type StreamingMessage = {
  id: string;
  role: 'assistant';
  text: string;
  isComplete: boolean;
};

export interface ChatSessionListProps {
  sessions: ChatSessionRecord[];
  activeSessionId: string | null;
  messages: ChatMessageRecord[];
  draftTitle: string;
  draftPrompt: string;
  supportsAgentMode?: boolean;
  agentModeStorageKey?: string;
  isAgentMode?: boolean;
  agentStatus?: AgentRunStatus;
  activeToolName?: string | null;
  streamingMessage?: StreamingMessage | null;
  toolCalls?: ToolCallItem[];
  onCreateSession: () => void;
  onDraftTitleChange: (value: string) => void;
  onDraftPromptChange: (value: string) => void;
  onSessionChange: (sessionId: string) => void;
  onSendPrompt: () => void;
  onAgentModeChange?: (value: boolean) => void;
}

export function ChatSessionList({
  sessions,
  activeSessionId,
  messages,
  draftTitle,
  draftPrompt,
  supportsAgentMode = false,
  agentModeStorageKey,
  isAgentMode = false,
  agentStatus = 'idle',
  activeToolName = null,
  streamingMessage = null,
  toolCalls = [],
  onCreateSession,
  onDraftTitleChange,
  onDraftPromptChange,
  onSessionChange,
  onSendPrompt,
  onAgentModeChange,
}: ChatSessionListProps) {
  const getIndicatorStatus = (): 'thinking' | 'executing' | 'completed' | 'error' | null => {
    if (!isAgentMode || agentStatus === 'idle') return null;
    
    switch (agentStatus) {
      case 'streaming':
        return 'thinking';
      case 'tool_running':
        return 'executing';
      case 'completed':
        return 'completed';
      case 'errored':
        return 'error';
      default:
        return null;
    }
  };

  const indicatorStatus = getIndicatorStatus();
  const isProcessing = agentStatus === 'streaming' || agentStatus === 'tool_running';

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
          {isAgentMode && indicatorStatus && (
            <div className="px-2">
              <AgentStatusIndicator 
                status={indicatorStatus} 
                toolName={activeToolName || undefined} 
              />
            </div>
          )}

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

            {streamingMessage && !streamingMessage.isComplete && (
              <div className={cx(
                "flex flex-col gap-1 max-w-[90%] items-start"
              )}>
                <div className={cx(
                  "px-3 py-2 rounded-2xl text-sm bg-muted text-foreground rounded-tl-none",
                  "animate-pulse"
                )}>
                  {streamingMessage.text}
                  <span className="inline-block w-1.5 h-3 ml-0.5 bg-current animate-pulse" />
                </div>
                <span className="text-[10px] text-muted-foreground px-1 uppercase tracking-tighter">
                  assistant • streaming
                </span>
              </div>
            )}

            {isAgentMode && toolCalls.length > 0 && (
              <div className="space-y-2 px-2">
                <span className="text-mono-label">工具调用</span>
                <div className="space-y-2">
                  {toolCalls.map((toolCall) => (
                    <AgentToolCall
                      key={toolCall.id}
                      toolName={toolCall.toolName}
                      args={toolCall.args}
                      status={toolCall.status}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t bg-muted/30 space-y-3">
        {supportsAgentMode && onAgentModeChange && (
          <AgentModeToggle
            isAgentMode={isAgentMode}
            onToggle={onAgentModeChange}
            storageKey={agentModeStorageKey}
          />
        )}
        <Textarea
          value={draftPrompt}
          onChange={(e) => onDraftPromptChange(e.target.value)}
          placeholder={isAgentMode ? "向 AI Agent 发送消息..." : "Message AI..."}
          className="min-h-[80px] text-sm bg-background"
          disabled={isProcessing}
        />
        <div className="flex gap-2">
          <Input 
            value={draftTitle}
            onChange={(e) => onDraftTitleChange(e.target.value)}
            placeholder="New session title..."
            className="h-8 text-xs flex-1"
            disabled={isProcessing}
          />
          <Button 
            variant="primary" 
            size="sm" 
            className="h-8" 
            onClick={onSendPrompt}
            disabled={isProcessing || !draftPrompt.trim()}
          >
            {isProcessing ? '处理中...' : 'Send'}
          </Button>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full h-8 text-xs" 
          onClick={onCreateSession}
          disabled={isProcessing}
        >
          New Session
        </Button>
      </div>
    </div>
  );
}
