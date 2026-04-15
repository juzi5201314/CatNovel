import {
  buildContextPacket,
  type ContextSelection,
} from './context-engine.ts';
import {
  findProviderProfile,
  listModelsByProvider,
  type ProviderFamily,
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

interface CallProviderParams {
  family: ProviderFamily;
  endpoint: string;
  apiKey: string;
  modelId: string;
  prompt: string;
  contextPacket: ReturnType<typeof buildContextPacket>;
  stream?: boolean;
}

interface ProviderResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export async function callProvider(params: CallProviderParams): Promise<ProviderResponse> {
  const { family, endpoint, apiKey, modelId, prompt, contextPacket } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const base = endpoint.replace(/\/+$/, '');
    const fullPrompt = `${contextPacket.combinedContext}\n\n${prompt}`.trim();

    switch (family) {
      case 'openai-compatible': {
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: fullPrompt }],
            stream: false,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }

        const data = await res.json();
        return {
          text: data.choices?.[0]?.message?.content ?? '',
          inputTokens: data.usage?.prompt_tokens ?? estimateTokenCount(fullPrompt),
          outputTokens: data.usage?.completion_tokens ?? estimateTokenCount(data.choices?.[0]?.message?.content ?? ''),
        };
      }

      case 'openai-responses': {
        const res = await fetch(`${base}/responses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelId,
            input: fullPrompt,
            stream: false,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }

        const data = await res.json();
        const text = data.output?.[0]?.content?.[0]?.text ?? data.text ?? '';
        return {
          text,
          inputTokens: data.usage?.input_tokens ?? estimateTokenCount(fullPrompt),
          outputTokens: data.usage?.output_tokens ?? estimateTokenCount(text),
        };
      }

      case 'claude-native': {
        const res = await fetch(`${base}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: fullPrompt }],
            max_tokens: 4096,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }

        const data = await res.json();
        const text = data.content?.[0]?.text ?? '';
        return {
          text,
          inputTokens: data.usage?.input_tokens ?? estimateTokenCount(fullPrompt),
          outputTokens: data.usage?.output_tokens ?? estimateTokenCount(text),
        };
      }

      case 'gemini-native': {
        const res = await fetch(
          `${base}/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }],
            }),
            signal: controller.signal,
          },
        );

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        return {
          text,
          inputTokens: estimateTokenCount(fullPrompt),
          outputTokens: estimateTokenCount(text),
        };
      }

      default:
        throw new Error(`Unsupported provider family: ${family}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
