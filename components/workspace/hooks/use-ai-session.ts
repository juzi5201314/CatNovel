'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { AgentEvent, AgentRunStatus } from '@/lib/contracts/agent-events';
import type {
  ActiveModelSelection,
  ChatMessageRecord,
  ChatSessionRecord,
} from '@/lib/contracts/workspace';

import type { StreamingMessage, ToolCallItem } from '@/components/ai/chat-session-list';
import type { WorkspaceMutationOptions, WorkspaceMutationResponse } from '../workspace-shell.types';

type MutateWorkspace = (
  payload: Record<string, unknown>,
  options?: WorkspaceMutationOptions,
) => Promise<WorkspaceMutationResponse>;

type RefreshWorkspace = (nextWorkId?: string, nextSessionId?: string) => Promise<void>;

export function useAiSession({
  activeModel,
  activeSessionId,
  activeWorkId,
  chatMessages,
  chatSessions,
  mutateWorkspace,
  refreshWorkspace,
}: {
  activeModel: ActiveModelSelection | null;
  activeSessionId: string | null;
  activeWorkId: string | null;
  chatMessages: ChatMessageRecord[];
  chatSessions: ChatSessionRecord[];
  mutateWorkspace: MutateWorkspace;
  refreshWorkspace: RefreshWorkspace;
}) {
  const [freeChatPrompt, setFreeChatPrompt] = useState('');
  const [agentStatus, setAgentStatus] = useState<AgentRunStatus>('idle');
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCallItem[]>([]);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const streamingStartTimeRef = useRef<number | null>(null);
  const streamingTokensRef = useRef(0);
  const latestStreamingTpsRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetAgentState = useCallback(() => {
    setAgentStatus('idle');
    setActiveToolName(null);
    setStreamingMessage(null);
    setToolCalls([]);
    streamingStartTimeRef.current = null;
    streamingTokensRef.current = 0;
    latestStreamingTpsRef.current = 0;
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      resetAgentState();
    });
  }, [activeSessionId, resetAgentState]);

  const calculateTPS = useCallback(() => {
    const startTime = streamingStartTimeRef.current;
    if (!startTime) {
      return 0;
    }

    const elapsed = (Date.now() - startTime) / 1000;
    return elapsed > 0 ? streamingTokensRef.current / elapsed : 0;
  }, []);

  const handleAgentEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case 'ai_start': {
        const startedAt = Date.now();
        setAgentStatus('streaming');
        setActiveToolName(null);
        streamingStartTimeRef.current = startedAt;
        streamingTokensRef.current = 0;
        latestStreamingTpsRef.current = 0;
        setStreamingMessage({
          id: event.messageId,
          role: 'assistant',
          text: '',
          isComplete: false,
          tps: 0,
        });
        return;
      }
      case 'ai_chunk': {
        setAgentStatus('streaming');
        setActiveToolName(null);
        streamingTokensRef.current += 1;
        const currentTPS = calculateTPS();
        latestStreamingTpsRef.current = currentTPS;
        setStreamingMessage({
          id: event.messageId,
          role: 'assistant',
          text: event.accumulatedText,
          isComplete: false,
          tps: currentTPS,
        });
        return;
      }
      case 'ai_tool_call': {
        setAgentStatus('tool_running');
        setActiveToolName(event.toolName);
        setToolCalls((current) => {
          const nextItem: ToolCallItem = {
            id: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
            status: 'running',
          };
          const index = current.findIndex((item) => item.id === event.toolCallId);

          if (index === -1) {
            return [...current, nextItem];
          }

          return current.map((item, itemIndex) => (itemIndex === index ? nextItem : item));
        });
        return;
      }
      case 'ai_tool_result': {
        setActiveToolName(null);
        setToolCalls((current) => current.map((item) => (
          item.id === event.toolCallId
            ? {
                ...item,
                status: event.isError ? 'error' : 'success',
                result: event.result,
                error: event.isError ? String(event.result) : undefined,
              }
            : item
        )));
        return;
      }
      case 'ai_complete': {
        setAgentStatus('completed');
        setActiveToolName(null);
        const finalTPS = Math.max(latestStreamingTpsRef.current, calculateTPS());
        latestStreamingTpsRef.current = finalTPS;
        setStreamingMessage({
          id: event.messageId,
          role: 'assistant',
          text: event.fullText,
          isComplete: true,
          tps: finalTPS,
        });
        return;
      }
      case 'ai_error': {
        setAgentStatus('errored');
        setActiveToolName(null);
        return;
      }
      default:
        return;
    }
  }, [calculateTPS]);

  const consumeAgentEventStream = useCallback(async (response: Response) => {
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? 'Agent request failed.');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Agent stream is unavailable.');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let finalText = '';

    const parseEventBlock = (block: string) => {
      const lines = block.split('\n');
      const dataLine = lines.find((line) => line.startsWith('data: '))?.slice(6).trim();

      if (!dataLine) {
        return;
      }

      const event = JSON.parse(dataLine) as AgentEvent;
      handleAgentEvent(event);

      if (event.type === 'ai_chunk') {
        finalText = event.accumulatedText;
      }

      if (event.type === 'ai_complete') {
        finalText = event.fullText;
      }

      if (event.type === 'ai_error') {
        throw new Error(event.error);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        if (block.trim()) {
          parseEventBlock(block);
        }
      }

      if (done) {
        if (buffer.trim()) {
          parseEventBlock(buffer);
        }
        break;
      }
    }

    return { finalText };
  }, [handleAgentEvent]);

  const generateSessionTitle = useCallback((prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      const now = new Date();
      return `${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    }

    const firstLine = trimmed.split('\n')[0];
    return firstLine.length > 20 ? `${firstLine.slice(0, 20)}...` : firstLine;
  }, []);

  const handleCreateSession = useCallback(async () => {
    if (!activeWorkId) {
      return;
    }

    const currentSession = chatSessions.find((session) => session.id === activeSessionId);
    if (currentSession && chatMessages.length === 0) {
      return;
    }

    const title = generateSessionTitle(freeChatPrompt);
    const result = await mutateWorkspace({ action: 'create-chat-session', workId: activeWorkId, title });

    if (result.result && typeof result.result === 'object' && 'session' in result.result) {
      const newSession = (result.result as { session: { id: string } }).session;
      if (newSession?.id) {
        await refreshWorkspace(undefined, newSession.id);
      }
    }
  }, [activeSessionId, activeWorkId, chatMessages.length, chatSessions, freeChatPrompt, generateSessionTitle, mutateWorkspace, refreshWorkspace]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    void mutateWorkspace({ action: 'delete-chat-session', sessionId });
  }, [mutateWorkspace]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    void mutateWorkspace({ action: 'delete-chat-message', messageId });
  }, [mutateWorkspace]);

  const handleAbort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleSendPrompt = useCallback(async (prompt?: string) => {
    const currentPrompt = prompt ?? freeChatPrompt;
    if (!currentPrompt.trim() || !activeModel) {
      return;
    }

    const trimmedPrompt = currentPrompt.trim();
    let sessionId = activeSessionId;

    if (!sessionId) {
      if (!activeWorkId) {
        return;
      }

      const title = generateSessionTitle(trimmedPrompt);
      const result = await mutateWorkspace({ action: 'create-chat-session', workId: activeWorkId, title });
      if (result.result && typeof result.result === 'object' && 'session' in result.result) {
        const newSession = (result.result as { session: { id: string } }).session;
        if (newSession?.id) {
          sessionId = newSession.id;
          await refreshWorkspace(undefined, newSession.id);
        }
      }

      if (!sessionId) {
        return;
      }
    }

    setFreeChatPrompt('');
    resetAgentState();

    await mutateWorkspace(
      {
        action: 'append-chat-message',
        sessionId,
        role: 'user',
        body: trimmedPrompt,
        tps: 0,
      },
      { preserveEditor: true, sessionId },
    );

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profileId: activeModel.profileId,
          modelId: activeModel.modelId,
          prompt: trimmedPrompt,
          sessionId,
        }),
        signal: abortControllerRef.current.signal,
      });

      const agentResult = await consumeAgentEventStream(response);

      if (agentResult.finalText.trim()) {
        await mutateWorkspace(
          {
            action: 'append-chat-message',
            sessionId,
            role: 'assistant',
            body: agentResult.finalText,
            tps: latestStreamingTpsRef.current,
          },
          { preserveEditor: true, sessionId },
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setAgentStatus('completed');
      } else {
        setAgentStatus('errored');
        toast.error(error instanceof Error ? error.message : 'AI 请求失败。');
      }
    } finally {
      abortControllerRef.current = null;
      setStreamingMessage(null);
      setToolCalls([]);
    }
  }, [activeModel, activeSessionId, activeWorkId, consumeAgentEventStream, freeChatPrompt, generateSessionTitle, mutateWorkspace, refreshWorkspace, resetAgentState]);

  const handleRetryMessage = useCallback(async (messageId: string) => {
    if (!activeSessionId || !activeModel) {
      return;
    }

    const messageIndex = chatMessages.findIndex((message) => message.id === messageId);
    if (messageIndex === -1) {
      return;
    }

    const message = chatMessages[messageIndex];
    if (message.role !== 'assistant') {
      return;
    }

    let userPrompt = '';
    for (let index = messageIndex - 1; index >= 0; index -= 1) {
      if (chatMessages[index].role === 'user') {
        userPrompt = chatMessages[index].body;
        break;
      }
    }

    if (!userPrompt) {
      toast.error('无法重试：未找到原始用户消息');
      return;
    }

    setRetryingMessageId(messageId);
    resetAgentState();

    try {
      const response = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profileId: activeModel.profileId,
          modelId: activeModel.modelId,
          prompt: userPrompt,
          sessionId: activeSessionId,
          upToMessageId: messageId,
        }),
      });

      const agentResult = await consumeAgentEventStream(response);

      if (agentResult.finalText.trim()) {
        const result = await mutateWorkspace(
          {
            action: 'add-message-version',
            messageId,
            body: agentResult.finalText,
            tps: latestStreamingTpsRef.current,
          },
          { sessionId: activeSessionId },
        );

        if (result.result && typeof result.result === 'object' && 'version' in result.result) {
          const version = (result.result as { version: { id: string } }).version;
          await mutateWorkspace(
            {
              action: 'set-active-message-version',
              messageId,
              versionId: version.id,
            },
            { sessionId: activeSessionId },
          );
        }
      }
    } catch (error) {
      setAgentStatus('errored');
      toast.error(error instanceof Error ? error.message : '重试失败。');
    } finally {
      setRetryingMessageId(null);
    }
  }, [activeModel, activeSessionId, chatMessages, consumeAgentEventStream, mutateWorkspace, resetAgentState]);

  const handleSwitchRetryVersion = useCallback(async (messageId: string, direction: 'prev' | 'next') => {
    const message = chatMessages.find((entry) => entry.id === messageId);
    if (!message || !message.versions || message.versions.length === 0) {
      return;
    }

    const currentVersionIndex = message.activeVersionId
      ? message.versions.findIndex((version) => version.id === message.activeVersionId)
      : -1;
    const effectiveIndex = currentVersionIndex === -1 ? -1 : currentVersionIndex;
    const newIndex = direction === 'prev'
      ? Math.max(-1, effectiveIndex - 1)
      : Math.min(message.versions.length - 1, effectiveIndex + 1);
    const newVersionId = newIndex === -1 ? null : message.versions[newIndex].id;

    await mutateWorkspace(
      {
        action: 'set-active-message-version',
        messageId,
        versionId: newVersionId,
      },
      { sessionId: activeSessionId },
    );
  }, [activeSessionId, chatMessages, mutateWorkspace]);

  return {
    freeChatPrompt,
    setFreeChatPrompt,
    agentStatus,
    activeToolName,
    streamingMessage,
    toolCalls,
    retryingMessageId,
    handleCreateSession,
    handleDeleteSession,
    handleDeleteMessage,
    handleAbort,
    handleSendPrompt,
    handleRetryMessage,
    handleSwitchRetryVersion,
  };
}
