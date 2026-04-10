import {
  buildContextPacket,
  type ContextSelection,
} from './context-engine';
import { findProviderProfile } from './provider-registry';

export type AiTaskClass =
  | '续写'
  | '改写'
  | '润色'
  | '扩写'
  | '自由对话'
  | 'ghost-text';

export interface GenerationRequest {
  profileId: string;
  modelId: string;
  taskClass: AiTaskClass;
  prompt: string;
  contextSelection: ContextSelection;
}

export interface TokenUsageRecord {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface GenerationResult {
  providerId: string;
  modelId: string;
  taskClass: AiTaskClass;
  streamed: true;
  ghostText: boolean;
  contextPacket: ReturnType<typeof buildContextPacket>;
  tokenUsage: TokenUsageRecord;
  text: string;
}

export function generateText(request: GenerationRequest): GenerationResult {
  const profile = findProviderProfile(request.profileId);
  const contextPacket = buildContextPacket(request.contextSelection);
  const tokenUsage = estimateTokenUsage(request.prompt, contextPacket);

  return {
    providerId: profile.id,
    modelId: request.modelId,
    taskClass: request.taskClass,
    streamed: true,
    ghostText: request.taskClass === 'ghost-text',
    contextPacket,
    tokenUsage,
    text: [
      `provider=${profile.label}`,
      `task=${request.taskClass}`,
      `context=${contextPacket.contextEngineLabel}`,
      `ghost=${request.taskClass === 'ghost-text'}`,
    ].join(' | '),
  };
}

function estimateTokenUsage(
  prompt: string,
  contextPacket: ReturnType<typeof buildContextPacket>,
): TokenUsageRecord {
  const inputTokens = Math.ceil(
    (prompt.length +
      contextPacket.settingsContext.length +
      contextPacket.summaryContext.length +
      contextPacket.manualContext.length) / 4,
  );
  const outputTokens = Math.max(64, Math.ceil(prompt.length / 3));

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}
