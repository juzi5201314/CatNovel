import type {
  AgentEvent as PiAgentEvent,
  AgentMessage,
} from '@mariozechner/pi-agent-core';
import type { AssistantMessage } from '@mariozechner/pi-ai';

import type {
  AgentEvent,
  AIChunkEvent,
  AICompleteEvent,
  AIErrorEvent,
  AIStartEvent,
  AIToolCallEvent,
  AIToolResultEvent,
} from '@/lib/contracts/agent-events.ts';

export interface EventTransformerContext {
  sessionId: string;
  messageId: string;
  model: string;
  timestamp?: number;
  lastAssistantText?: string;
  errorMessage?: string;
}

export type TransformedAgentEvent = AgentEvent;

export function transformEvent(
  piEvent: PiAgentEvent,
  context: EventTransformerContext,
): TransformedAgentEvent | null {
  const timestamp = context.timestamp ?? Date.now();

  switch (piEvent.type) {
    case 'agent_start':
      return buildStartEvent(context, timestamp);

    case 'turn_start':
    case 'turn_end':
      return null;

    case 'message_start': {
      if (!isAssistantMessage(piEvent.message)) {
        return null;
      }

      return buildChunkEvent({
        sessionId: context.sessionId,
        messageId: context.messageId,
        timestamp,
        textDelta: '',
        accumulatedText: extractAssistantText(piEvent.message),
      });
    }

    case 'message_update': {
      if (
        !isAssistantMessage(piEvent.message) ||
        piEvent.assistantMessageEvent.type !== 'text_delta'
      ) {
        return null;
      }

      return buildChunkEvent({
        sessionId: context.sessionId,
        messageId: context.messageId,
        timestamp,
        textDelta: piEvent.assistantMessageEvent.delta,
        accumulatedText: extractAssistantText(piEvent.message),
      });
    }

    case 'tool_execution_start':
      return buildToolCallEvent(context, piEvent, timestamp);

    case 'tool_execution_end':
      return buildToolResultEvent(context, piEvent, timestamp);

    case 'agent_end':
      return buildTerminalEvent(piEvent, context, timestamp);

    default:
      return null;
  }
}

function buildStartEvent(
  context: EventTransformerContext,
  timestamp: number,
): AIStartEvent {
  return {
    type: 'ai_start',
    model: context.model,
    timestamp,
    sessionId: context.sessionId,
    messageId: context.messageId,
  };
}

interface ChunkEventInput {
  sessionId: string;
  messageId: string;
  timestamp: number;
  textDelta: string;
  accumulatedText: string;
}

function buildChunkEvent(input: ChunkEventInput): AIChunkEvent {
  return {
    type: 'ai_chunk',
    textDelta: input.textDelta,
    accumulatedText: input.accumulatedText,
    timestamp: input.timestamp,
    sessionId: input.sessionId,
    messageId: input.messageId,
  };
}

function buildToolCallEvent(
  context: EventTransformerContext,
  event: Extract<PiAgentEvent, { type: 'tool_execution_start' }>,
  timestamp: number,
): AIToolCallEvent {
  return {
    type: 'ai_tool_call',
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    args: toRecord(event.args),
    timestamp,
    sessionId: context.sessionId,
    messageId: context.messageId,
  };
}

function buildToolResultEvent(
  context: EventTransformerContext,
  event: Extract<PiAgentEvent, { type: 'tool_execution_end' }>,
  timestamp: number,
): AIToolResultEvent {
  return {
    type: 'ai_tool_result',
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    result: unwrapToolResultDetails(event.result),
    isError: event.isError,
    timestamp,
    sessionId: context.sessionId,
    messageId: context.messageId,
  };
}

function unwrapToolResultDetails(value: unknown): unknown {
  if (
    typeof value === 'object' &&
    value !== null &&
    'details' in value
  ) {
    return (value as { details: unknown }).details;
  }

  return value;
}

function buildTerminalEvent(
  event: Extract<PiAgentEvent, { type: 'agent_end' }>,
  context: EventTransformerContext,
  timestamp: number,
): AICompleteEvent | AIErrorEvent {
  const finalAssistantMessage = findLastAssistantMessage(event.messages);
  const finalText = finalAssistantMessage
    ? extractAssistantText(finalAssistantMessage)
    : context.lastAssistantText ?? '';
  const errorMessage = finalAssistantMessage?.errorMessage;
  const contextErrorMessage = context.errorMessage;

  if (isFailedAssistantMessage(finalAssistantMessage)) {
    return {
      type: 'ai_error',
      error: errorMessage ?? 'Agent run failed.',
      timestamp,
      sessionId: context.sessionId,
      messageId: context.messageId,
    };
  }

  if (errorMessage || contextErrorMessage) {
    return {
      type: 'ai_error',
      error: errorMessage ?? contextErrorMessage ?? 'Agent run failed.',
      timestamp,
      sessionId: context.sessionId,
      messageId: context.messageId,
    };
  }

  return {
    type: 'ai_complete',
    fullText: finalText,
    timestamp,
    sessionId: context.sessionId,
    messageId: context.messageId,
  };
}

function findLastAssistantMessage(
  messages: AgentMessage[],
): AssistantMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (isAssistantMessage(message)) {
      return message;
    }
  }

  return undefined;
}

function isAssistantMessage(message: AgentMessage | undefined): message is AssistantMessage {
  return isObject(message) && message.role === 'assistant';
}

function isFailedAssistantMessage(
  message: AssistantMessage | undefined,
): boolean {
  return message?.stopReason === 'error' || message?.stopReason === 'aborted';
}

function extractAssistantText(message: AssistantMessage): string {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

function toRecord(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
