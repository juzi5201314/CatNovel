import { LlmDefaultSelectionRepository } from "@/repositories/llm-default-selection-repository";
import { LlmModelPresetsRepository } from "@/repositories/llm-model-presets-repository";
import { LlmProvidersRepository } from "@/repositories/llm-providers-repository";
import { SecretStoreRepository } from "@/repositories/secret-store-repository";

const DEFAULT_EMBEDDING_PRESET_ID = "preset_embedding_default";
const EMBEDDING_ENDPOINT_PATH = "/embeddings";
const EMBEDDING_BATCH_SIZE = 16;
const EMBEDDING_TIMEOUT_MS = 60_000;
const EMBEDDING_MAX_ATTEMPTS = 3;
const EMBEDDING_RETRY_BASE_MS = 300;

const defaultSelectionRepository = new LlmDefaultSelectionRepository();
const modelPresetsRepository = new LlmModelPresetsRepository();
const providersRepository = new LlmProvidersRepository();
const secretStoreRepository = new SecretStoreRepository();

let lastKnownDimensions = 0;

export type EmbeddingOverride = {
  baseURL?: string;
  modelId?: string;
  thinkingBudget?: unknown;
};

export type EmbeddingOptions = {
  projectId?: string;
  embeddingPresetId?: string;
  override?: EmbeddingOverride;
};

type EmbeddingRuntimeConfig = {
  modelId: string;
  endpoint: string;
  apiKey?: string;
};

type EmbeddingApiRow = {
  index: number;
  embedding: number[];
};

function sanitizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function readErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim().length > 0) {
    return record.error.trim();
  }
  if (!record.error || typeof record.error !== "object" || Array.isArray(record.error)) {
    return null;
  }
  const nested = record.error as Record<string, unknown>;
  if (typeof nested.message === "string" && nested.message.trim().length > 0) {
    return nested.message.trim();
  }
  return null;
}

function ensureEmbeddingRows(payload: unknown): EmbeddingApiRow[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("embedding response must be an object");
  }

  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    throw new Error("embedding response missing data array");
  }

  return data
    .map((item, fallbackIndex) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("embedding item must be an object");
      }
      const row = item as Record<string, unknown>;
      if (!Array.isArray(row.embedding)) {
        throw new Error("embedding item missing embedding vector");
      }
      const vector = row.embedding.map((value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          throw new Error("embedding vector contains non-numeric value");
        }
        return numeric;
      });
      const index = Number.isInteger(row.index) ? (row.index as number) : fallbackIndex;
      return {
        index,
        embedding: vector,
      };
    })
    .sort((left, right) => left.index - right.index);
}

function resolveEmbeddingPresetId(options: EmbeddingOptions): string {
  if (options.embeddingPresetId && options.embeddingPresetId.trim().length > 0) {
    return options.embeddingPresetId.trim();
  }

  if (options.projectId && options.projectId.trim().length > 0) {
    const defaults = defaultSelectionRepository.getByProjectId(options.projectId.trim());
    if (defaults?.defaultEmbeddingPresetId) {
      return defaults.defaultEmbeddingPresetId;
    }
  }

  return DEFAULT_EMBEDDING_PRESET_ID;
}

function resolveRuntimeConfig(options: EmbeddingOptions): EmbeddingRuntimeConfig {
  const presetId = resolveEmbeddingPresetId(options);
  const preset = modelPresetsRepository.findById(presetId);
  if (!preset) {
    throw new Error(`embedding preset not found: ${presetId}`);
  }
  if (preset.purpose !== "embedding") {
    throw new Error(`preset is not embedding purpose: ${presetId}`);
  }
  if (preset.apiFormat !== "embeddings") {
    throw new Error(`embedding preset must use embeddings api format: ${presetId}`);
  }

  const provider = providersRepository.findById(preset.providerId);
  if (!provider) {
    throw new Error(`embedding provider not found: ${preset.providerId}`);
  }
  if (!provider.enabled) {
    throw new Error(`embedding provider disabled: ${provider.id}`);
  }
  if (provider.category !== "embedding" && provider.category !== "both") {
    throw new Error(`provider category does not support embeddings: ${provider.id}`);
  }

  const modelId = options.override?.modelId?.trim() || preset.modelId.trim();
  if (!modelId) {
    throw new Error(`embedding model id is empty: ${presetId}`);
  }

  const baseURL = options.override?.baseURL?.trim() || provider.baseUrl.trim();
  if (!baseURL) {
    throw new Error(`embedding provider baseUrl is empty: ${provider.id}`);
  }

  const apiKeyFromProvider = provider.apiKeyRef
    ? secretStoreRepository.readPlaintext(provider.apiKeyRef)
    : null;
  if (provider.apiKeyRef && !apiKeyFromProvider) {
    throw new Error(`embedding provider api key missing: ${provider.id}`);
  }

  const endpoint = `${sanitizeBaseUrl(baseURL)}${EMBEDDING_ENDPOINT_PATH}`;
  const apiKey =
    apiKeyFromProvider ??
    process.env.CATNOVEL_EMBEDDING_API_KEY ??
    process.env.OPENAI_API_KEY;

  return {
    modelId,
    endpoint,
    apiKey,
  };
}

async function requestEmbeddingBatch(
  runtime: EmbeddingRuntimeConfig,
  texts: string[],
): Promise<number[][]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, EMBEDDING_TIMEOUT_MS);

  try {
    const response = await fetch(runtime.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(runtime.apiKey ? { authorization: `Bearer ${runtime.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: runtime.modelId,
        input: texts,
      }),
      signal: controller.signal,
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        readErrorMessage(payload) ??
        `embedding provider request failed with status ${response.status}`;
      throw new Error(`embedding provider request failed with status ${response.status}: ${message}`);
    }

    const rows = ensureEmbeddingRows(payload);
    if (rows.length !== texts.length) {
      throw new Error(
        `embedding batch size mismatch: expected ${texts.length}, got ${rows.length}`,
      );
    }

    return rows.map((row) => row.embedding);
  } finally {
    clearTimeout(timeoutId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetryEmbedding(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "AbortError") {
    return true;
  }

  const message = error.message.toLowerCase();
  if (message.includes("fetch failed") || message.includes("operation was aborted")) {
    return true;
  }

  return /status\s+(429|5\d\d)/.test(message);
}

async function requestEmbeddingBatchWithRetry(
  runtime: EmbeddingRuntimeConfig,
  texts: string[],
): Promise<number[][]> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= EMBEDDING_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await requestEmbeddingBatch(runtime, texts);
    } catch (error) {
      lastError = error;
      if (attempt >= EMBEDDING_MAX_ATTEMPTS || !shouldRetryEmbedding(error)) {
        break;
      }
      const backoffMs = EMBEDDING_RETRY_BASE_MS * attempt;
      await sleep(backoffMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("embedding request failed");
}

function updateDimensions(vectors: number[][]): void {
  const dimensions = vectors[0]?.length ?? 0;
  if (dimensions > 0) {
    lastKnownDimensions = dimensions;
  }
}

export async function embedText(
  text: string,
  options: EmbeddingOptions = {},
): Promise<number[]> {
  const vectors = await embedTexts([text], options);
  return vectors[0] ?? [];
}

export async function embedTexts(
  texts: string[],
  options: EmbeddingOptions = {},
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const runtime = resolveRuntimeConfig(options);
  const vectors: number[][] = [];

  for (let index = 0; index < texts.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(index, index + EMBEDDING_BATCH_SIZE);
    const batchVectors = await requestEmbeddingBatchWithRetry(runtime, batch);
    vectors.push(...batchVectors);
  }

  updateDimensions(vectors);
  return vectors;
}

export function embeddingDimensions(): number {
  return lastKnownDimensions;
}
