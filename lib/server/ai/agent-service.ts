import { Agent } from '@mariozechner/pi-agent-core';
import type {
  AfterToolCallContext,
  AfterToolCallResult,
  AgentEvent as PiAgentEvent,
  AgentMessage,
  AgentState,
  AgentTool,
} from '@mariozechner/pi-agent-core';
import type {
  AssistantMessage,
  Model,
  UserMessage,
  Api,
} from '@mariozechner/pi-ai';

import type { AgentEvent, AgentRunStatus } from '@/lib/contracts/agent-events.ts';

import {
  buildContextPacket,
  type ContextPacket,
  type ContextSelection,
} from './context-engine.ts';
import { transformEvent } from './event-transformer.ts';
import {
  createAgentTools,
  isWrappedToolExecutionDetails,
  type ToolExecutionConfig,
} from './tool-execution.ts';
import type { ToolDefinition } from './tools/types.ts';

export interface AgentServiceConfig {
  model: Model<Api>;
  systemPrompt?: string;
  tools?: Array<AgentTool | ToolDefinition>;
  toolExecution?: ToolExecutionConfig;
  contextSelection?: ContextSelection;
  steeringMode?: AgentQueueMode;
  followUpMode?: AgentQueueMode;
  sessionId?: string;
}

export type AgentQueueMode = 'all' | 'one-at-a-time';

export interface AgentServiceState {
  sessionId: string;
  status: AgentRunStatus;
  activeToolName: string | null;
  model: Model<Api>;
  systemPrompt: string;
  messages: AgentState['messages'];
  isStreaming: boolean;
  errorMessage?: string;
}

export type AgentServiceListener = (event: AgentEvent) => void;

export class AgentService {
  private readonly agent: Agent;
  private readonly eventListeners = new Set<AgentServiceListener>();
  private readonly sessionId: string;
  private readonly toolExecutionConfig: ToolExecutionConfig;
  private contextSelection: ContextSelection;
  private status: AgentRunStatus = 'idle';
  private activeToolName: string | null = null;
  private currentMessageId = createIdentifier();
  private currentStreamText = '';
  private lastAssistantText = '';

  constructor(config: AgentServiceConfig) {
    this.sessionId = config.sessionId ?? createIdentifier();
    this.contextSelection = cloneContextSelection(config.contextSelection);
    this.toolExecutionConfig = config.toolExecution ?? {};
    this.agent = new Agent({
      initialState: {
        model: config.model,
        systemPrompt: config.systemPrompt ?? '',
        tools: normalizeTools(config.tools, this.toolExecutionConfig),
      },
      transformContext: async (messages, signal) =>
        this.transformContext(messages, signal),
      afterToolCall: async (context) => this.handleAfterToolCall(context),
      steeringMode: config.steeringMode,
      followUpMode: config.followUpMode,
      sessionId: this.sessionId,
    });

    this.agent.subscribe((event) => {
      this.handleAgentEvent(event);
    });
  }

  async prompt(userMessage: string): Promise<void> {
    await this.agent.prompt(userMessage);
  }

  async continue(): Promise<void> {
    await this.agent.continue();
  }

  async waitForIdle(): Promise<void> {
    await this.agent.waitForIdle();
  }

  steer(userMessage: string): void {
    this.agent.steer(buildQueuedUserMessage(userMessage));
  }

  followUp(userMessage: string): void {
    this.agent.followUp(buildQueuedUserMessage(userMessage));
  }

  clearSteeringQueue(): void {
    this.agent.clearSteeringQueue();
  }

  clearFollowUpQueue(): void {
    this.agent.clearFollowUpQueue();
  }

  setSteeringMode(mode: AgentQueueMode): void {
    this.agent.steeringMode = mode;
  }

  setFollowUpMode(mode: AgentQueueMode): void {
    this.agent.followUpMode = mode;
  }

  abort(): void {
    this.agent.abort();
  }

  subscribe(listener: AgentServiceListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  setContextSelection(selection: ContextSelection): void {
    this.contextSelection = cloneContextSelection(selection);
  }

  setModel(model: Model<Api>): void {
    this.agent.state.model = model;
  }

  setSystemPrompt(systemPrompt: string): void {
    this.agent.state.systemPrompt = systemPrompt;
  }

  setTools(tools: Array<AgentTool | ToolDefinition>): void {
    this.agent.state.tools = normalizeTools(tools, this.toolExecutionConfig);
  }

  getMessages(): AgentMessage[] {
    return [...this.agent.state.messages];
  }

  getFinalMessage(): AssistantMessage | undefined {
    return findLastAssistantMessage(this.agent.state.messages);
  }

  reset(): void {
    this.agent.reset();
    this.status = 'idle';
    this.activeToolName = null;
    this.currentMessageId = createIdentifier();
    this.currentStreamText = '';
    this.lastAssistantText = '';
    this.emitState();
  }

  getState(): AgentServiceState {
    return {
      sessionId: this.sessionId,
      status: this.status,
      activeToolName: this.activeToolName,
      model: this.agent.state.model,
      systemPrompt: this.agent.state.systemPrompt,
      messages: this.getMessages(),
      isStreaming: this.agent.state.isStreaming,
      errorMessage: this.agent.state.errorMessage,
    };
  }

  private async transformContext(
    messages: AgentMessage[],
    signal?: AbortSignal,
  ): Promise<AgentMessage[]> {
    if (signal?.aborted) {
      return messages;
    }

    const contextPacket = buildContextPacket(this.contextSelection);
    if (!contextPacket.combinedContext) {
      return messages;
    }

    return [buildContextMessage(contextPacket), ...messages];
  }

  private handleAgentEvent(event: PiAgentEvent): void {
    switch (event.type) {
      case 'agent_start': {
        this.currentMessageId = createIdentifier();
        this.currentStreamText = '';
        this.lastAssistantText = '';
        this.activeToolName = null;
        this.status = 'streaming';

        this.emitTransformedEvent(event);
        this.emitState();
        break;
      }

      case 'message_start': {
        if (isAssistantMessage(event.message)) {
          this.currentStreamText = extractAssistantText(event.message);
        }

        this.emitTransformedEvent(event);
        break;
      }

      case 'message_update': {
        if (
          isAssistantMessage(event.message) &&
          event.assistantMessageEvent.type === 'text_delta'
        ) {
          this.currentStreamText += event.assistantMessageEvent.delta;
          this.emitTransformedEvent(event);
        }
        break;
      }

      case 'message_end': {
        if (isAssistantMessage(event.message)) {
          this.lastAssistantText = extractAssistantText(event.message);
          this.emit({
            type: 'ai_message_snapshot',
            role: 'assistant',
            body: this.lastAssistantText,
            tokenCount: readOutputTokens(event.message),
            isFinal: false,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            messageId: this.currentMessageId,
          });
        }
        break;
      }

      case 'tool_execution_start': {
        this.activeToolName = event.toolName;
        this.status = 'tool_running';
        this.emitTransformedEvent(event);
        this.emitState();
        break;
      }

      case 'tool_execution_end': {
        this.activeToolName = null;
        this.status = 'streaming';
        this.emitTransformedEvent(event);
        this.emitState();
        break;
      }

      case 'agent_end': {
        const finalAssistantMessage = findLastAssistantMessage(event.messages);
        const finalText = finalAssistantMessage
          ? extractAssistantText(finalAssistantMessage)
          : this.lastAssistantText;
        const finalTimestamp = Date.now();

        if (finalAssistantMessage) {
          this.emit({
            type: 'ai_message_snapshot',
            role: 'assistant',
            body: finalText,
            tokenCount: readOutputTokens(finalAssistantMessage),
            isFinal: true,
            timestamp: finalTimestamp,
            sessionId: this.sessionId,
            messageId: this.currentMessageId,
          });
        }

        this.activeToolName = null;
        this.status = isFailedAssistantMessage(finalAssistantMessage) || this.agent.state.errorMessage
          ? 'errored'
          : 'completed';
        this.emitTransformedEvent(event, {
          timestamp: finalTimestamp,
          lastAssistantText: finalText,
          errorMessage: this.agent.state.errorMessage,
        });
        this.emitState();
        break;
      }

      default:
        break;
    }
  }

  private async handleAfterToolCall(
    context: AfterToolCallContext,
  ): Promise<AfterToolCallResult | undefined> {
    if (!isWrappedToolExecutionDetails(context.result.details)) {
      return undefined;
    }

    return {
      details: context.result.details.result,
      isError: context.result.details.isError,
    };
  }

  private emitState(): void {
    this.emit({
      type: 'ai_state',
      status: this.status,
      activeToolName: this.activeToolName,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      messageId: this.currentMessageId,
    });
  }

  private emit(event: AgentEvent): void {
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  private emitTransformedEvent(
    event: PiAgentEvent,
    overrides?: Partial<Parameters<typeof transformEvent>[1]>,
  ): void {
    const transformedEvent = transformEvent(event, {
      sessionId: this.sessionId,
      messageId: this.currentMessageId,
      model: this.agent.state.model.id,
      lastAssistantText: this.lastAssistantText,
      ...overrides,
    });

    if (transformedEvent) {
      this.emit(transformedEvent);
    }
  }
}

function normalizeTools(
  tools: Array<AgentTool | ToolDefinition> | undefined,
  toolExecutionConfig: ToolExecutionConfig,
): AgentTool[] {
  return (tools ?? []).flatMap((tool) => {
    if (isToolDefinition(tool)) {
      return createAgentTools([tool], toolExecutionConfig);
    }

    return [tool];
  });
}

function isToolDefinition(tool: AgentTool | ToolDefinition): tool is ToolDefinition {
  return 'handler' in tool;
}

function buildContextMessage(contextPacket: ContextPacket): UserMessage {
  return {
    role: 'user',
    content: [
      'Workspace context follows. Treat it as background context, not as a direct user request.',
      `Context engine: ${contextPacket.contextEngineLabel}`,
      contextPacket.chapter ? `Chapter:\n${contextPacket.chapter}` : '',
      contextPacket.settingsContext ? `Settings:\n${contextPacket.settingsContext}` : '',
      contextPacket.summaryContext ? `Summaries:\n${contextPacket.summaryContext}` : '',
      contextPacket.manualContext ? `Manual selections:\n${contextPacket.manualContext}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    timestamp: Date.now(),
  };
}

function buildQueuedUserMessage(content: string): UserMessage {
  return {
    role: 'user',
    content,
    timestamp: Date.now(),
  };
}

function cloneContextSelection(selection?: ContextSelection): ContextSelection {
  return {
    chapter: selection?.chapter ?? '',
    settings: [...(selection?.settings ?? [])],
    summaries: [...(selection?.summaries ?? [])],
    manualSelections: [...(selection?.manualSelections ?? [])],
  };
}

function isAssistantMessage(message: AgentMessage): message is AssistantMessage {
  return isObject(message) && message.role === 'assistant';
}

function findLastAssistantMessage(
  messages: AgentMessage[],
): AssistantMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message && isAssistantMessage(message)) {
      return message;
    }
  }

  return undefined;
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

function readOutputTokens(message: AssistantMessage): number {
  return message.usage.output || estimateTokenCount(extractAssistantText(message));
}

function estimateTokenCount(text: string): number {
  return Math.max(0, Math.ceil(text.length / 4));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createIdentifier(): string {
  return crypto.randomUUID();
}
