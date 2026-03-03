import { embedMany } from "ai";

import { buildEmbeddingModel } from "@/core/ai-runtime/model-factory";
import { LlmDefaultSelectionRepository } from "@/repositories/llm-default-selection-repository";
import { LlmModelPresetsRepository } from "@/repositories/llm-model-presets-repository";
import { LlmProvidersRepository } from "@/repositories/llm-providers-repository";
import { isSecretAuthenticationError } from "@/lib/crypto/secret-errors";
import { SecretStoreRepository } from "@/repositories/secret-store-repository";

const DEFAULT_EMBEDDING_PRESET_ID = "preset_embedding_default";
const BUILTIN_OPENAI_BASE_PLACEHOLDER = "https://api.openai-compatible.local/v1";
const BUILTIN_DEEPSEEK_BASE_DEFAULT = "https://api.deepseek.com";

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
  model: ReturnType<typeof buildEmbeddingModel>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toEnvSegment(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function readFirstEnv(keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key];
    if (isNonEmptyString(value)) {
      return value.trim();
    }
  }
  return null;
}

function normalizeBaseURL(rawBaseURL: string): string {
  const trimmed = rawBaseURL.trim();
  if (trimmed.length === 0) {
    throw new Error("embedding provider baseURL is empty");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("embedding provider baseURL is invalid");
  }

  if (!url.protocol.startsWith("http")) {
    throw new Error("embedding provider baseURL must use http/https");
  }

  return trimmed.replace(/\/+$/, "");
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

function resolveProviderApiKey(provider: NonNullable<ReturnType<LlmProvidersRepository["findById"]>>): string {
  if (provider.apiKeyRef) {
    let plainText: string | null = null;
    try {
      plainText = secretStoreRepository.readPlaintext(provider.apiKeyRef);
    } catch (error) {
      if (isSecretAuthenticationError(error)) {
        throw new Error(
          `embedding provider api key decrypt failed, please re-save provider api key: ${provider.id}`,
        );
      }
      throw new Error(`embedding provider api key read failed: ${provider.id}`);
    }

    if (isNonEmptyString(plainText)) {
      return plainText.trim();
    }
    throw new Error(`embedding provider api key missing: ${provider.id}`);
  }

  const providerKeyCandidates = [
    `LLM_PROVIDER_${toEnvSegment(provider.id)}_API_KEY`,
    provider.builtinCode
      ? `LLM_BUILTIN_${toEnvSegment(provider.builtinCode)}_API_KEY`
      : null,
  ].filter((item): item is string => Boolean(item));

  const builtinKeyCandidates: string[] = [];
  if (provider.builtinCode === "builtin_openai_compatible") {
    builtinKeyCandidates.push("OPENAI_API_KEY");
  } else if (provider.builtinCode === "builtin_deepseek_compatible") {
    builtinKeyCandidates.push("DEEPSEEK_API_KEY");
  }

  const apiKey = readFirstEnv([...providerKeyCandidates, ...builtinKeyCandidates, "API_KEY"]);
  if (apiKey) {
    return apiKey;
  }

  throw new Error(`embedding provider api key missing: ${provider.id}`);
}

function resolveBaseURL(
  provider: NonNullable<ReturnType<LlmProvidersRepository["findById"]>>,
  overrideBaseURL?: string,
): string {
  if (isNonEmptyString(overrideBaseURL)) {
    return normalizeBaseURL(overrideBaseURL);
  }

  const providerBaseURL = readFirstEnv([`LLM_PROVIDER_${toEnvSegment(provider.id)}_BASE_URL`]);
  if (providerBaseURL) {
    return normalizeBaseURL(providerBaseURL);
  }

  if (provider.builtinCode === "builtin_openai_compatible") {
    if (provider.baseUrl === BUILTIN_OPENAI_BASE_PLACEHOLDER) {
      const openaiBaseURL = readFirstEnv(["OPENAI_BASE_URL"]);
      if (openaiBaseURL) {
        return normalizeBaseURL(openaiBaseURL);
      }
    }
  }

  if (provider.builtinCode === "builtin_deepseek_compatible") {
    if (provider.baseUrl === BUILTIN_DEEPSEEK_BASE_DEFAULT) {
      const deepseekBaseURL = readFirstEnv(["DEEPSEEK_BASE_URL"]);
      if (deepseekBaseURL) {
        return normalizeBaseURL(deepseekBaseURL);
      }
    }
  }

  return normalizeBaseURL(provider.baseUrl);
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
  if (preset.chatApiFormat !== null && preset.chatApiFormat !== undefined) {
    throw new Error(`embedding preset must not set chatApiFormat: ${presetId}`);
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

  const baseURL = resolveBaseURL(provider, options.override?.baseURL);
  const apiKey = resolveProviderApiKey(provider);
  const customUserAgent =
    typeof preset.customUserAgent === "string" && preset.customUserAgent.trim().length > 0
      ? preset.customUserAgent.trim()
      : undefined;

  return {
    model: buildEmbeddingModel({
      providerId: provider.id,
      modelId,
      baseURL,
      apiKey,
      customUserAgent,
      providerProtocol: provider.protocol,
    }),
  };
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
  const result = await embedMany({
    model: runtime.model,
    values: texts,
    maxRetries: 2,
  });

  updateDimensions(result.embeddings);
  return result.embeddings;
}

export function embeddingDimensions(): number {
  return lastKnownDimensions;
}
