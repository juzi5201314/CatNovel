import type { ChatRole } from './workspace.ts';

export const publicAgentEventTypes = [
  'ai_start',
  'ai_chunk',
  'ai_tool_call',
  'ai_tool_result',
  'ai_ask_user_pending',
  'ai_complete',
  'ai_error',
] as const;

export const internalAgentEventTypes = [
  'ai_state',
  'ai_message_snapshot',
] as const;

export const agentEventTypes = [
  ...publicAgentEventTypes,
  ...internalAgentEventTypes,
] as const;

export type PublicAgentEventType = (typeof publicAgentEventTypes)[number];
export type InternalAgentEventType = (typeof internalAgentEventTypes)[number];
export type AgentEventType = (typeof agentEventTypes)[number];

export type AgentRunStatus =
  | 'idle'
  | 'streaming'
  | 'tool_running'
  | 'completed'
  | 'errored';

export interface AgentEventBase {
  type: AgentEventType;
  timestamp: number;
  sessionId: string;
  messageId: string;
}

export interface AIStartEvent extends AgentEventBase {
  type: 'ai_start';
  model: string;
}

export interface AIChunkEvent extends AgentEventBase {
  type: 'ai_chunk';
  textDelta: string;
  accumulatedText: string;
}

export interface AIToolCallEvent extends AgentEventBase {
  type: 'ai_tool_call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface AIToolResultEvent extends AgentEventBase {
  type: 'ai_tool_result';
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError: boolean;
}

export interface AIAskUserPendingEvent extends AgentEventBase {
  type: 'ai_ask_user_pending';
  toolCallId: string;
  question: string;
  options?: string[];
  multiselect?: boolean;
  context?: string;
}

export interface AICompleteEvent extends AgentEventBase {
  type: 'ai_complete';
  fullText: string;
}

export interface AIErrorEvent extends AgentEventBase {
  type: 'ai_error';
  error: string;
}

export interface AIStateEvent extends AgentEventBase {
  type: 'ai_state';
  status: AgentRunStatus;
  activeToolName: string | null;
}

export interface AIMessageSnapshotEvent extends AgentEventBase {
  type: 'ai_message_snapshot';
  role: Extract<ChatRole, 'assistant'>;
  body: string;
  tokenCount: number;
  isFinal: boolean;
}

export type PublicAgentEvent =
  | AIStartEvent
  | AIChunkEvent
  | AIToolCallEvent
  | AIToolResultEvent
  | AIAskUserPendingEvent
  | AICompleteEvent
  | AIErrorEvent;

export type InternalAgentEvent = AIStateEvent | AIMessageSnapshotEvent;

export type AgentEvent = PublicAgentEvent | InternalAgentEvent;

export function isAIStartEvent(event: AgentEvent): event is AIStartEvent {
  return event.type === 'ai_start';
}

export function isAIChunkEvent(event: AgentEvent): event is AIChunkEvent {
  return event.type === 'ai_chunk';
}

export function isAIToolCallEvent(event: AgentEvent): event is AIToolCallEvent {
  return event.type === 'ai_tool_call';
}

export function isAIToolResultEvent(event: AgentEvent): event is AIToolResultEvent {
  return event.type === 'ai_tool_result';
}

export function isAIAskUserPendingEvent(event: AgentEvent): event is AIAskUserPendingEvent {
  return event.type === 'ai_ask_user_pending';
}

export function isAICompleteEvent(event: AgentEvent): event is AICompleteEvent {
  return event.type === 'ai_complete';
}

export function isAIErrorEvent(event: AgentEvent): event is AIErrorEvent {
  return event.type === 'ai_error';
}

export function isAIStateEvent(event: AgentEvent): event is AIStateEvent {
  return event.type === 'ai_state';
}

export function isAIMessageSnapshotEvent(
  event: AgentEvent,
): event is AIMessageSnapshotEvent {
  return event.type === 'ai_message_snapshot';
}

export function isPublicAgentEvent(event: AgentEvent): event is PublicAgentEvent {
  return publicAgentEventTypes.includes(event.type as PublicAgentEventType);
}

export function isInternalAgentEvent(event: AgentEvent): event is InternalAgentEvent {
  return internalAgentEventTypes.includes(event.type as InternalAgentEventType);
}
