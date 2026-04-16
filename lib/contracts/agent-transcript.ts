import type { AgentEventType, PublicAgentEventType } from './agent-events.ts';
import type { AgentRunStatus, AIToolResultEvent } from './agent-events.ts';
import type { ChatRole } from './workspace.ts';

export const transcriptEntryRoles = ['user', 'assistant', 'tool'] as const;

export type TranscriptEntryRole = Extract<ChatRole, 'user' | 'assistant'> | 'tool';

export const persistedTranscriptEventTypes = [
  'user_message',
  'ai_complete',
  'ai_tool_result',
] as const;

export type PersistedTranscriptEventType =
  (typeof persistedTranscriptEventTypes)[number];

export const transientTranscriptEventTypes = [
  'ai_start',
  'ai_chunk',
  'ai_tool_call',
  'ai_error',
  'ai_state',
  'ai_message_snapshot',
] as const satisfies readonly AgentEventType[];

export type TransientTranscriptEventType = AgentEventType;

export type TranscriptWriteMode =
  | 'immediate'
  | 'on_tool_result'
  | 'on_assistant_complete'
  | 'never';

export type ToolResultPayload = Pick<
  AIToolResultEvent,
  'toolCallId' | 'toolName' | 'result' | 'isError'
>;

export interface TranscriptEntryMetadata {
  modelId?: string;
  tokenCount?: number;
  toolCallId?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  isError?: boolean;
  sourceEventTypes?: Array<PersistedTranscriptEventType | PublicAgentEventType>;
}

export interface TranscriptEntry {
  id: string;
  sessionId: string;
  messageId: string;
  sequence: number;
  createdAt: string;
  role: TranscriptEntryRole;
  content: string;
  isPersistent: boolean;
  persistToDatabase: boolean;
  metadata?: TranscriptEntryMetadata;
}

export interface TranscriptTransientState {
  eventType: TransientTranscriptEventType;
  timestamp: number;
  reason: 'streaming' | 'ui_only' | 'runtime_only';
}

export interface AgentTranscript {
  sessionId: string;
  modelId: string;
  startedAt: string;
  completedAt?: string;
  status: AgentRunStatus;
  entries: TranscriptEntry[];
  transientStates: TranscriptTransientState[];
}

export interface TranscriptPersistenceConfig {
  persistUserMessages: boolean;
  persistAssistantMessages: boolean;
  persistToolCalls: boolean;
  persistToolResults: boolean;
  persistStreamingEvents: boolean;
  userMessageWriteMode: TranscriptWriteMode;
  assistantMessageWriteMode: TranscriptWriteMode;
  toolResultWriteMode: TranscriptWriteMode;
  compatibilityMirror: 'chat_messages' | 'agent_transcript_entries' | 'dual_write';
}

export const defaultTranscriptPersistenceConfig: TranscriptPersistenceConfig = {
  persistUserMessages: true,
  persistAssistantMessages: true,
  persistToolCalls: false,
  persistToolResults: true,
  persistStreamingEvents: false,
  userMessageWriteMode: 'immediate',
  assistantMessageWriteMode: 'on_assistant_complete',
  toolResultWriteMode: 'on_tool_result',
  compatibilityMirror: 'dual_write',
};

export function createToolTranscriptEntry(input: {
  id: string;
  sessionId: string;
  messageId: string;
  sequence: number;
  createdAt: string;
  toolArgs: Record<string, unknown>;
  toolResult: ToolResultPayload;
}): TranscriptEntry {
  return {
    id: input.id,
    sessionId: input.sessionId,
    messageId: input.messageId,
    sequence: input.sequence,
    createdAt: input.createdAt,
    role: 'tool',
    content: JSON.stringify(input.toolResult.result),
    isPersistent: true,
    persistToDatabase: true,
    metadata: {
      toolCallId: input.toolResult.toolCallId,
      toolName: input.toolResult.toolName,
      toolArgs: input.toolArgs,
      toolResult: input.toolResult.result,
      isError: input.toolResult.isError,
      sourceEventTypes: ['ai_tool_result'],
    },
  };
}
