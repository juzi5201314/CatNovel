import {
  streamChatTokens,
  type ChatApiFormat,
  type ChatMessage,
  type ChatStreamInput,
} from "@/mastra/agents/chat-agent";
import {
  streamGenerateTokens,
  type GenerateStreamInput,
  type GenerateTaskType,
} from "@/mastra/workflows/generate-workflow";
import {
  resolveContext,
  type ContextToolCall,
  type ContextUsedPayload,
} from "@/mastra/tools/context-tool";

export type ChatOverride = {
  apiFormat?: ChatApiFormat;
  baseURL?: string;
  modelId?: string;
  thinkingBudget?: unknown;
};

export type ChatRequestInput = {
  projectId: string;
  chapterId?: string;
  messages: ChatMessage[];
  chatPresetId?: string;
  retrieval?: {
    topK?: number;
    enableGraph?: "auto" | "on" | "off";
  };
  override?: ChatOverride;
};

export type GenerateRequestInput = {
  projectId: string;
  chapterId?: string;
  taskType: GenerateTaskType;
  prompt: string;
  selection?: string;
  chatPresetId?: string;
  override?: ChatOverride;
};

export type PreparedStream = {
  toolCall: ContextToolCall;
  contextUsed: ContextUsedPayload;
};

export function isValidApiFormat(value: unknown): value is ChatApiFormat {
  return value === "chat_completions" || value === "responses";
}

function pickQueryFromMessages(messages: ChatMessage[]): string {
  return [...messages].reverse().find((item) => item.role === "user")?.content ?? "";
}

export async function prepareChatStream(input: ChatRequestInput): Promise<PreparedStream> {
  return resolveContext({
    projectId: input.projectId,
    chapterId: input.chapterId,
    query: pickQueryFromMessages(input.messages),
    topK: input.retrieval?.topK,
  });
}

export async function prepareGenerateStream(
  input: GenerateRequestInput,
): Promise<PreparedStream> {
  return resolveContext({
    projectId: input.projectId,
    chapterId: input.chapterId,
    query: input.prompt,
  });
}

export function runChatStream(input: ChatRequestInput, signal: AbortSignal): AsyncGenerator<string> {
  const payload: ChatStreamInput = {
    projectId: input.projectId,
    messages: input.messages,
    chatPresetId: input.chatPresetId,
    override: input.override,
  };
  return streamChatTokens(payload, signal);
}

export function runGenerateStream(
  input: GenerateRequestInput,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const payload: GenerateStreamInput = {
    projectId: input.projectId,
    taskType: input.taskType,
    prompt: input.prompt,
    selection: input.selection,
    chatPresetId: input.chatPresetId,
    override: input.override,
  };
  return streamGenerateTokens(payload, signal);
}

export {
  runTimelineExtractionWorkflow,
  type TimelineWorkflowInput,
  type TimelineWorkflowOutput,
  type TimelineEntityCandidate,
  type TimelineEventCandidate,
} from "@/mastra/workflows/timeline-workflow";
