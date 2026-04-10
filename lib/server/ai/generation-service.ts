import {
  buildContextPacket,
  type ContextSelection,
} from './context-engine.ts';
import {
  findProviderProfile,
  listModelsByProvider,
} from './provider-registry.ts';
import {
  archiveTokenUsage,
  type TokenUsageRecord,
} from './token-usage-archive.ts';

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
  stream?: boolean;
  failMode?:
    | 'missing-api-key'
    | 'provider-timeout'
    | 'model-list-fetch-failure'
    | 'malformed-model-response';
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
  chunks: string[];
}

export function generateText(request: GenerationRequest): GenerationResult {
  const profile = findProviderProfile(request.profileId);
  const contextPacket = buildContextPacket(request.contextSelection);
  assertGenerationRequest(request, profile.apiKey);

  const availableModels = listModelsByProvider(request.profileId);
  if (!availableModels.some((model) => model.id === request.modelId)) {
    throw new Error(`Unknown model for provider ${request.profileId}: ${request.modelId}`);
  }

  const text = [
    `provider=${profile.label}`,
    `task=${request.taskClass}`,
    `context=${contextPacket.contextEngineLabel}`,
    `settings=${contextPacket.settingsCount}`,
    `summaries=${contextPacket.summaryCount}`,
    `manual=${contextPacket.manualSelectionCount}`,
    `ghost=${request.taskClass === 'ghost-text'}`,
  ].join(' | ');

  const archivedTokenUsage = archiveTokenUsage({
    providerId: profile.id,
    modelId: request.modelId,
    taskClass: request.taskClass,
    ...estimateTokenUsage(request.prompt, contextPacket),
  });

  return {
    providerId: profile.id,
    modelId: request.modelId,
    taskClass: request.taskClass,
    streamed: true,
    ghostText: request.taskClass === 'ghost-text',
    contextPacket,
    tokenUsage: archivedTokenUsage,
    text,
    chunks: buildStreamChunks(text, request.taskClass),
  };
}

export function createGenerationStream(result: GenerationResult) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of result.chunks) {
        controller.enqueue(
          `event: token\ndata: ${JSON.stringify({
            modelId: result.modelId,
            taskClass: result.taskClass,
            chunk,
          })}\n\n`,
        );
      }

      controller.enqueue(
        `event: done\ndata: ${JSON.stringify({
          providerId: result.providerId,
          tokenUsageId: result.tokenUsage.id,
          ghostText: result.ghostText,
        })}\n\n`,
      );
      controller.close();
    },
  });
}

function assertGenerationRequest(
  request: GenerationRequest,
  apiKey: string,
) {
  if (request.failMode === 'missing-api-key' || !apiKey.trim()) {
    throw new Error('Missing API key for provider profile.');
  }

  if (request.failMode === 'provider-timeout') {
    throw new Error('Provider timeout while streaming generation.');
  }

  if (request.failMode === 'model-list-fetch-failure') {
    throw new Error('Model list fetch failure prevented generation.');
  }

  if (request.failMode === 'malformed-model-response') {
    throw new Error('Malformed model response during generation.');
  }
}

function estimateTokenUsage(
  prompt: string,
  contextPacket: ReturnType<typeof buildContextPacket>,
) {
  const inputTokens = Math.ceil(
    (prompt.length + contextPacket.combinedContext.length) / 4,
  );
  const outputTokens = Math.max(64, Math.ceil(prompt.length / 3));

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

function buildStreamChunks(text: string, taskClass: AiTaskClass) {
  return [
    `[${taskClass}]`,
    text.slice(0, Math.ceil(text.length / 2)),
    text.slice(Math.ceil(text.length / 2)),
  ].filter(Boolean);
}
