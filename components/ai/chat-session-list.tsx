'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  ChatMessageRecord,
  ChatSessionRecord,
} from '@/lib/contracts/workspace';
import type { AgentRunStatus } from '@/lib/contracts/agent-events';


import { Textarea } from '../ui/textarea';
import { AgentToolCall } from './agent-tool-call';
import { MarkdownContent } from './markdown-content';
import { cx } from '@/lib/design/cx';
import { toast } from 'sonner';

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
  tps?: number;
};

export interface ChatSessionListProps {
  sessions: ChatSessionRecord[];
  activeSessionId: string | null;
  messages: ChatMessageRecord[];
  draftPrompt: string;
  agentStatus?: AgentRunStatus;
  activeToolName?: string | null;
  streamingMessage?: StreamingMessage | null;
  toolCalls?: ToolCallItem[];
  providers: { id: string; label: string; enabled: boolean; modelIds: string[] }[];
  activeModel: { profileId: string; modelId: string } | null;
  retryingMessageId?: string | null;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onDraftPromptChange: (value: string) => void;
  onSessionChange: (sessionId: string) => void;
  onSendPrompt: (prompt?: string) => void;
  onAbort: () => void;
  onRetryMessage: (messageId: string, previousBody?: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onSwitchRetryVersion?: (messageId: string, direction: 'prev' | 'next') => void;
  onOpenModelSettings: () => void;
}

// Icons
function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15V5a2 2 0 012-2h10" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
    </svg>
  );
}

// 会话下拉菜单组件
function SessionMenu({
  sessions,
  activeSessionId,
  onSessionChange,
  onDeleteSession,
}: {
  sessions: ChatSessionRecord[];
  activeSessionId: string | null;
  onSessionChange: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cx(
          "p-2 rounded-lg transition-colors flex items-center gap-1",
          isOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
        title="Sessions"
      >
        <ListIcon className="w-4 h-4" />
        <ChevronDownIcon className={cx("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full mt-1 w-56 bg-background border rounded-lg shadow-lg z-[100] py-1">
            <div className="px-3 py-2 border-b">
              <span className="text-xs font-medium text-muted-foreground">切换会话</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cx(
                    "flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer",
                    session.id === activeSessionId && "bg-muted"
                  )}
                >
                  <span
                    className="flex-1 truncate pr-2"
                    onClick={() => {
                      onSessionChange(session.id);
                      setIsOpen(false);
                    }}
                  >
                    {session.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                      if (session.id === activeSessionId) {
                        setIsOpen(false);
                      }
                    }}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="删除"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {sessions.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                暂无会话
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// 消息操作按钮组件
function MessageActions({
  messageId,
  messageText,
  isUser,
  onRetry,
  onDelete,
  versions,
  activeVersionId,
  onSwitchVersion,
}: {
  messageId: string;
  messageText: string;
  isUser: boolean;
  onRetry?: (messageId: string, previousBody?: string) => void;
  onDelete: (messageId: string) => void;
  versions?: { id: string; body: string; tps: number; createdAt: string }[];
  activeVersionId?: string | null;
  onSwitchVersion?: (direction: 'prev' | 'next') => void;
}) {
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      toast.success('已复制到剪贴板');
    } catch {
      toast.error('复制失败');
    }
  }, [messageText]);

  const totalVersions = versions ? versions.length + 1 : 1;
  const currentVersionIndex = activeVersionId
    ? (versions?.findIndex((v) => v.id === activeVersionId) ?? -1)
    : -1;
  const effectiveIndex = currentVersionIndex === -1 ? 0 : currentVersionIndex + 1;
  const hasMultipleVersions = totalVersions > 1;

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity px-1">
      {hasMultipleVersions && onSwitchVersion && (
        <div className="flex items-center gap-0.5 mr-1">
          <button
            onClick={() => onSwitchVersion('prev')}
            disabled={effectiveIndex === 0}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            title="上一个版本"
          >
            <ChevronLeftIcon className="w-3 h-3" />
          </button>
          <span className="text-[10px] text-muted-foreground tabular-nums min-w-[24px] text-center">
            {effectiveIndex + 1}/{totalVersions}
          </span>
          <button
            onClick={() => onSwitchVersion('next')}
            disabled={effectiveIndex === totalVersions - 1}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            title="下一个版本"
          >
            <ChevronRightIcon className="w-3 h-3" />
          </button>
        </div>
      )}
      {!isUser && onRetry && (
        <button
          onClick={() => onRetry(messageId, messageText)}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="重试"
        >
          <RefreshIcon className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        onClick={handleCopy}
        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="复制"
      >
        <CopyIcon className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onDelete(messageId)}
        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        title="删除"
      >
        <TrashIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// 虚化Tips背景组件
function EmptyStateTips({
  onQuickPrompt,
}: {
  onQuickPrompt: (prompt: string) => void;
}) {
  const tips = [
    "你好，我是你的AI助手，有什么可以帮你的吗？",
    "帮我润色这段文字...",
    "生成一段场景描写...",
    "这个角色的心理活动应该怎么写？",
  ];

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center space-y-4 pointer-events-auto">
        <p className="text-sm text-muted-foreground/60 font-medium">开始对话</p>
        <div className="space-y-2">
          {tips.map((tip, index) => (
            <button
              key={index}
              onClick={() => onQuickPrompt(tip)}
              className="block w-full px-4 py-2 text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30 rounded-lg transition-all"
            >
              {tip}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChatSessionList({
  sessions,
  activeSessionId,
  messages,
  draftPrompt,
  agentStatus = 'idle',
  activeToolName = null,
  streamingMessage = null,
  toolCalls = [],
  providers,
  activeModel,
  retryingMessageId = null,
  onCreateSession,
  onDeleteSession,
  onDraftPromptChange,
  onSessionChange,
  onSendPrompt,
  onAbort,
  onRetryMessage,
  onDeleteMessage,
  onSwitchRetryVersion,
  onOpenModelSettings,
}: ChatSessionListProps) {
  const isProcessing = agentStatus === 'streaming' || agentStatus === 'tool_running';

  const activeModelInfo = activeModel
    ? (() => {
        const profile = providers.find((p) => p.id === activeModel.profileId);
        const isValid = profile && profile.enabled && profile.modelIds.includes(activeModel.modelId);
        return {
          label: activeModel.modelId,
          isValid,
          profile,
        };
      })()
    : { label: '—', isValid: false, profile: null };

  const hasMessages = messages.length > 0 || (streamingMessage && !streamingMessage.isComplete);
  const canSend = !isProcessing && draftPrompt.trim() && activeModelInfo.isValid;

  const handleQuickPrompt = useCallback((prompt: string) => {
    onDraftPromptChange(prompt);
  }, [onDraftPromptChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!isProcessing && draftPrompt.trim()) {
        onSendPrompt(draftPrompt);
      }
    }
  }, [draftPrompt, isProcessing, onSendPrompt]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length, streamingMessage?.text, toolCalls.length]);

  return (
    <div className="flex flex-col h-full bg-background" id="ai-sessions">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-1">
          <SessionMenu
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSessionChange={onSessionChange}
            onDeleteSession={onDeleteSession}
          />
          <button
            onClick={onCreateSession}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            title="New Session"
            disabled={isProcessing}
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 消息显示区域 */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 relative">
        {/* 空状态提示 */}
        {!hasMessages && (
          <EmptyStateTips onQuickPrompt={handleQuickPrompt} />
        )}

        <div className="space-y-4">
          {messages.map((message) => {
            const isRetrying = retryingMessageId === message.id;

            if (isRetrying) {
              const retryText = streamingMessage?.text ?? '';
              return (
                <div
                  key={message.id}
                  className="flex flex-col gap-1 max-w-[90%] items-start"
                >
                  <div className={cx(
                    "px-3 py-2 rounded-2xl text-sm bg-muted text-foreground rounded-tl-none",
                    "animate-pulse"
                  )}>
                    <MarkdownContent content={retryText} />
                    <span className="inline-block w-1.5 h-3 ml-0.5 bg-current animate-pulse" />
                  </div>
                  {streamingMessage?.tps && streamingMessage.tps > 0 ? (
                    <span className="text-[10px] text-muted-foreground tabular-nums px-1">
                      {streamingMessage.tps.toFixed(1)} T/s
                    </span>
                  ) : null}
                </div>
              );
            }

            // 确定显示的内容：如果有激活版本则显示版本内容，否则显示原始内容
            const activeVersion = message.versions?.find(
              (v) => v.id === message.activeVersionId
            );
            const displayBody = activeVersion?.body ?? message.body;
            const displayTps = activeVersion?.tps ?? message.tps;

            return (
              <div
                key={message.id}
                className={cx(
                  "flex flex-col gap-1 max-w-[90%] group",
                  message.role === 'user' ? "ml-auto items-end" : "items-start"
                )}
              >
                <div className={cx(
                  "px-3 py-2 rounded-2xl text-sm",
                  message.role === 'user'
                    ? "bg-black text-white rounded-tr-none"
                    : "bg-muted text-foreground rounded-tl-none"
                )}>
                  {message.role === 'assistant'
                    ? <MarkdownContent content={displayBody} />
                    : displayBody}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {displayTps > 0 ? `${displayTps.toFixed(1)} T/s` : ''}
                  </span>
                  <MessageActions
                    messageId={message.id}
                    messageText={displayBody}
                    isUser={message.role === 'user'}
                    onRetry={message.role === 'assistant' ? onRetryMessage : undefined}
                    onDelete={onDeleteMessage}
                    versions={message.versions}
                    activeVersionId={message.activeVersionId}
                    onSwitchVersion={
                      message.versions && message.versions.length > 0 && onSwitchRetryVersion
                        ? (direction) => onSwitchRetryVersion(message.id, direction)
                        : undefined
                    }
                  />
                </div>
              </div>
            );
          })}

          {streamingMessage && !streamingMessage.isComplete && !retryingMessageId && (
            <div className="flex flex-col gap-1 max-w-[90%] items-start">
              <div className={cx(
                "px-3 py-2 rounded-2xl text-sm bg-muted text-foreground rounded-tl-none",
                "animate-pulse"
              )}>
                <MarkdownContent content={streamingMessage.text} />
                <span className="inline-block w-1.5 h-3 ml-0.5 bg-current animate-pulse" />
              </div>
              {streamingMessage.tps && streamingMessage.tps > 0 ? (
                <span className="text-[10px] text-muted-foreground tabular-nums px-1">
                  {streamingMessage.tps.toFixed(1)} T/s
                </span>
              ) : null}
            </div>
          )}

          {/* 工具调用 */}
          {toolCalls.length > 0 && (
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

      {/* 底部输入区 */}
      <div className="p-4 border-t bg-muted/30">
        <div className="relative">
          <Textarea
            value={draftPrompt}
            onChange={(e) => onDraftPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeModelInfo.isValid ? "向 AI Agent 发送消息..." : "请先选择有效的 AI 模型"}
            className={cx(
              "min-h-[80px] text-sm pr-24 resize-none pb-6",
              activeModelInfo.isValid ? "bg-background" : "bg-destructive/5 border-destructive/20"
            )}
            disabled={isProcessing || !activeModelInfo.isValid}
          />
          {/* 输入框内提示 */}
          {activeModelInfo.isValid ? (
            !draftPrompt.trim() && !isProcessing && (
              <div className="absolute bottom-2 left-3 text-[10px] text-muted-foreground/40 pointer-events-none">
                Cmd/Ctrl + Enter 发送
              </div>
            )
          ) : (
            <div className="absolute bottom-2 left-3 text-[10px] text-destructive pointer-events-none">
              模型不可用，请重新选择
            </div>
          )}
          {/* 右下角按钮组 */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            {/* 模型选择按钮 */}
            <button
              onClick={onOpenModelSettings}
              className={cx(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono transition-colors",
                activeModelInfo.isValid
                  ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                  : "text-destructive bg-destructive/10 hover:bg-destructive/20"
              )}
              title={activeModelInfo.isValid ? "选择模型" : "模型不可用，点击重新选择"}
            >
              <SettingsIcon className="w-3 h-3" />
              <span className="truncate max-w-[80px]">{activeModelInfo.label}</span>
            </button>
            {isProcessing ? (
              <button
                type="button"
                onClick={onAbort}
                className={cx(
                  "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90 animate-pulse"
                )}
                title="终止生成"
              >
                <StopIcon className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSendPrompt(draftPrompt)}
                disabled={!canSend}
                className={cx(
                  "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                  activeModelInfo.isValid
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-destructive/20 text-destructive cursor-not-allowed",
                  !draftPrompt.trim() && "opacity-50"
                )}
              >
                <SendIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
