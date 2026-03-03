import { LlmDefaultSelectionRepository } from "@/repositories/llm-default-selection-repository";
import { LlmModelPresetsRepository } from "@/repositories/llm-model-presets-repository";
import { LlmProvidersRepository } from "@/repositories/llm-providers-repository";
import { isSecretAuthenticationError } from "@/lib/crypto/secret-errors";
import { SecretStoreRepository } from "@/repositories/secret-store-repository";

import { LlmRuntimeError } from "./errors";
import { parseThinkingBudget } from "./thinking-budget";
import type {
  ChatApiFormat,
  ResolveLlmConfigInput,
  ResolvedLlmConfig,
  ThinkingBudget,
} from "./types";

const FALLBACK_CHAT_PRESET_ID = "preset_chat_completions_default";
const BUILTIN_OPENAI_BASE_PLACEHOLDER = "https://api.openai-compatible.local/v1";
const BUILTIN_DEEPSEEK_BASE_DEFAULT = "https://api.deepseek.com";

const modelPresetsRepository = new LlmModelPresetsRepository();
const providersRepository = new LlmProvidersRepository();
const defaultSelectionRepository = new LlmDefaultSelectionRepository();
const secretStoreRepository = new SecretStoreRepository();

type ChatPresetRecord = NonNullable<ReturnType<LlmModelPresetsRepository["findById"]>>;
type ProviderRecord = NonNullable<ReturnType<LlmProvidersRepository["findById"]>>;

type ResolvedPresetResult = {
  preset: ChatPresetRecord;
  source: "explicit" | "project_default" | "builtin_default" | "first_available";
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
    throw new LlmRuntimeError({
      code: "LLM_CONFIG_ERROR",
      message: "baseURL 不能为空",
      retryable: false,
    });
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new LlmRuntimeError({
      code: "LLM_CONFIG_ERROR",
      message: "baseURL 非法",
      retryable: false,
    });
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new LlmRuntimeError({
      code: "LLM_CONFIG_ERROR",
      message: "baseURL 必须是 http/https",
      retryable: false,
    });
  }

  const normalized = trimmed.replace(/\/+$/, "");
  return normalized;
}

function ensureChatPreset(record: ChatPresetRecord | null, message: string): ChatPresetRecord {
  if (!record) {
    throw new LlmRuntimeError({
      code: "LLM_CONFIG_ERROR",
      message,
      retryable: false,
    });
  }

  if (record.purpose !== "chat") {
    throw new LlmRuntimeError({
      code: "LLM_CONFIG_ERROR",
      message: "指定 preset 不是 chat 类型",
      retryable: false,
      details: { presetId: record.id },
    });
  }

  return record;
}

function resolvePreset(projectId: string, chatPresetId?: string): ResolvedPresetResult {
  if (isNonEmptyString(chatPresetId)) {
    const preset = ensureChatPreset(
      modelPresetsRepository.findById(chatPresetId),
      "chatPresetId 不存在",
    );
    return { preset, source: "explicit" };
  }

  const projectDefault = defaultSelectionRepository.getByProjectId(projectId);
  if (projectDefault?.defaultChatPresetId) {
    const defaultPreset = modelPresetsRepository.findById(projectDefault.defaultChatPresetId);
    if (defaultPreset && defaultPreset.purpose === "chat") {
      return { preset: defaultPreset, source: "project_default" };
    }

    console.warn("[llm] invalid_project_default_chat_preset", {
      projectId,
      defaultChatPresetId: projectDefault.defaultChatPresetId,
    });
  }

  const builtinFallback = modelPresetsRepository.findById(FALLBACK_CHAT_PRESET_ID);
  if (builtinFallback && builtinFallback.purpose === "chat") {
    return { preset: builtinFallback, source: "builtin_default" };
  }

  const firstChatPreset = modelPresetsRepository
    .list()
    .find((record) => record.purpose === "chat");
  if (!firstChatPreset) {
    throw new LlmRuntimeError({
      code: "LLM_CONFIG_ERROR",
      message: "未找到可用的 chat preset",
      retryable: false,
    });
  }

  return {
    preset: firstChatPreset,
    source: "first_available",
  };
}

function mapPresetThinkingBudget(preset: ChatPresetRecord): ThinkingBudget | undefined {
  if (preset.thinkingBudgetType === "effort" && preset.thinkingEffort) {
    return { type: "effort", effort: preset.thinkingEffort };
  }

  if (
    preset.thinkingBudgetType === "tokens" &&
    Number.isInteger(preset.thinkingTokens) &&
    (preset.thinkingTokens as number) > 0
  ) {
    return { type: "tokens", tokens: preset.thinkingTokens as number };
  }

  return undefined;
}

function resolveProvider(preset: ChatPresetRecord): ProviderRecord {
  const provider = providersRepository.findById(preset.providerId);
  if (!provider) {
    throw new LlmRuntimeError({
      code: "LLM_CONFIG_ERROR",
      message: "preset 关联 provider 不存在",
      retryable: false,
      details: { presetId: preset.id, providerId: preset.providerId },
    });
  }

  if (!provider.enabled) {
    throw new LlmRuntimeError({
      code: "LLM_CONFIG_ERROR",
      message: "provider 已被禁用",
      retryable: false,
      details: { providerId: provider.id },
    });
  }

  return provider;
}

function resolveProviderApiKey(provider: ProviderRecord): string {
  if (provider.apiKeyRef) {
    let plainText: string | null = null;
    try {
      plainText = secretStoreRepository.readPlaintext(provider.apiKeyRef);
    } catch (error) {
      throw new LlmRuntimeError({
        code: "LLM_CONFIG_ERROR",
        message: isSecretAuthenticationError(error)
          ? "provider API Key 解密失败，请在设置里重新保存该 Provider 的 API Key"
          : "provider API Key 无法读取",
        retryable: false,
        details: { providerId: provider.id },
        cause: error,
      });
    }

    if (isNonEmptyString(plainText)) {
      return plainText.trim();
    }
    throw new LlmRuntimeError({
      code: "LLM_CONFIG_ERROR",
      message: "provider API Key 无法读取",
      retryable: false,
      details: { providerId: provider.id },
    });
  }

  const providerKeyCandidates = [
    `LLM_PROVIDER_${toEnvSegment(provider.id)}_API_KEY`,
    provider.builtinCode
      ? `LLM_BUILTIN_${toEnvSegment(provider.builtinCode)}_API_KEY`
      : null,
  ].filter((item): item is string => Boolean(item));

  const builtinKeyCandidates: string[] = [];
  if (
    provider.builtinCode === "builtin_openai_compatible" ||
    provider.builtinCode === "builtin_openai_responses"
  ) {
    builtinKeyCandidates.push("OPENAI_API_KEY");
  } else if (provider.builtinCode === "builtin_deepseek_compatible") {
    builtinKeyCandidates.push("DEEPSEEK_API_KEY");
  }

  const apiKey = readFirstEnv([...providerKeyCandidates, ...builtinKeyCandidates, "API_KEY"]);
  if (apiKey) {
    return apiKey;
  }

  throw new LlmRuntimeError({
    code: "LLM_CONFIG_ERROR",
    message: "provider API Key 未配置",
    retryable: false,
    details: { providerId: provider.id },
  });
}

function resolveBaseURL(provider: ProviderRecord, overrideBaseURL?: string): string {
  if (isNonEmptyString(overrideBaseURL)) {
    return normalizeBaseURL(overrideBaseURL);
  }

  const providerBaseURL = readFirstEnv([`LLM_PROVIDER_${toEnvSegment(provider.id)}_BASE_URL`]);
  if (providerBaseURL) {
    return normalizeBaseURL(providerBaseURL);
  }

  if (
    provider.builtinCode === "builtin_openai_compatible" ||
    provider.builtinCode === "builtin_openai_responses"
  ) {
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

function resolveApiFormat(
  preset: ChatPresetRecord,
  overrideApiFormat?: ChatApiFormat,
): ChatApiFormat {
  const presetApiFormat = preset.chatApiFormat;
  if (!presetApiFormat) {
    throw new LlmRuntimeError({
      code: "LLM_CONFIG_ERROR",
      message: "chat preset 缺少 chatApiFormat",
      retryable: false,
      details: { presetId: preset.id },
    });
  }

  const apiFormat = overrideApiFormat ?? presetApiFormat;
  if (apiFormat !== "chat_completions" && apiFormat !== "responses") {
    throw new LlmRuntimeError({
      code: "LLM_CONFIG_ERROR",
      message: "apiFormat 仅支持 chat_completions 或 responses",
      retryable: false,
    });
  }
  return apiFormat;
}

function resolveModelId(preset: ChatPresetRecord, overrideModelId?: string): string {
  const modelId = isNonEmptyString(overrideModelId)
    ? overrideModelId.trim()
    : preset.modelId.trim();
  if (modelId.length === 0) {
    throw new LlmRuntimeError({
      code: "LLM_CONFIG_ERROR",
      message: "modelId 不能为空",
      retryable: false,
    });
  }
  return modelId;
}

function resolveThinkingBudget(
  preset: ChatPresetRecord,
  overrideThinkingBudget: unknown,
): ThinkingBudget | undefined {
  const parsed = parseThinkingBudget(overrideThinkingBudget);
  if (!parsed.ok) {
    throw new LlmRuntimeError({
      code: "LLM_CONFIG_ERROR",
      message: parsed.message,
      retryable: false,
    });
  }
  return parsed.data ?? mapPresetThinkingBudget(preset);
}

function normalizeTemperature(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function normalizeMaxTokens(value: unknown): number | undefined {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    return undefined;
  }
  return value as number;
}

function normalizeCustomUserAgent(value: unknown): string | undefined {
  if (!isNonEmptyString(value)) {
    return undefined;
  }
  return value.trim();
}

export function resolveChatRuntimeConfig(input: ResolveLlmConfigInput): ResolvedLlmConfig {
  const resolvedPreset = resolvePreset(input.projectId, input.chatPresetId);
  const provider = resolveProvider(resolvedPreset.preset);
  const apiKey = resolveProviderApiKey(provider);
  const baseURL = resolveBaseURL(provider, input.override?.baseURL);
  const apiFormat = resolveApiFormat(resolvedPreset.preset, input.override?.apiFormat);
  const modelId = resolveModelId(resolvedPreset.preset, input.override?.modelId);
  const thinkingBudget = resolveThinkingBudget(
    resolvedPreset.preset,
    input.override?.thinkingBudget,
  );

  const resolvedConfig: ResolvedLlmConfig = {
    presetId: resolvedPreset.preset.id,
    presetSource: resolvedPreset.source,
    providerId: provider.id,
    providerName: provider.name,
    providerProtocol: provider.protocol,
    baseURL,
    apiKey,
    customUserAgent: normalizeCustomUserAgent(resolvedPreset.preset.customUserAgent),
    apiFormat,
    modelId,
    temperature: normalizeTemperature(resolvedPreset.preset.temperature),
    maxTokens: normalizeMaxTokens(resolvedPreset.preset.maxTokens),
    thinkingBudget,
  };

  console.info("[llm] resolved_runtime_config", {
    projectId: input.projectId,
    requestPresetId: input.chatPresetId ?? null,
    resolvedPresetId: resolvedConfig.presetId,
    presetSource: resolvedConfig.presetSource,
    providerId: resolvedConfig.providerId,
    apiFormat: resolvedConfig.apiFormat,
    modelId: resolvedConfig.modelId,
    hasCustomUserAgent: Boolean(resolvedConfig.customUserAgent),
    hasThinkingBudget: Boolean(resolvedConfig.thinkingBudget),
  });

  return resolvedConfig;
}
