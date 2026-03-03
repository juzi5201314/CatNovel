import type { LanguageModel } from "ai";

import {
  resolveChatRuntimeConfig,
  type ChatOverride,
  type ChatApiFormat,
  type ResolvedLlmConfig,
} from "@/core/llm";

import { buildChatLanguageModel, normalizeProviderId } from "./model-factory";

export type ResolveAiRuntimeInput = {
  projectId: string;
  chatPresetId?: string;
  override?: ChatOverride;
};

export type ResolvedAiRuntime = {
  model: LanguageModel;
  callSettings: {
    temperature?: number;
    maxOutputTokens?: number;
    providerOptions?: Record<string, Record<string, string | number | boolean | null>>;
  };
  resolved: ResolvedLlmConfig;
};

function resolveMaxOutputTokens(config: ResolvedLlmConfig): number | undefined {
  if (config.thinkingBudget?.type === "tokens") {
    return config.thinkingBudget.tokens;
  }
  return config.maxTokens;
}

function resolveProviderOptions(
  config: ResolvedLlmConfig,
): Record<string, Record<string, string | number | boolean | null>> | undefined {
  const normalizedProviderId = normalizeProviderId(config.providerId);
  const sharedOptions: Record<string, string | number | boolean | null> = {};

  if (config.thinkingBudget?.type === "effort") {
    sharedOptions.reasoningEffort = config.thinkingBudget.effort;
  }

  if (config.apiFormat === "responses") {
    sharedOptions.parallelToolCalls = false;
    // 约束：当前网关在工具续跑场景会因 store=true 走 item_reference 历史路径并超时。
    // 采用硬切换策略：Responses API 统一禁用持久化历史（store=false）。
    sharedOptions.store = false;
  }

  if (Object.keys(sharedOptions).length === 0) {
    return undefined;
  }

  const providerOptionValue = { ...sharedOptions };

  return {
    [normalizedProviderId]: providerOptionValue,
    openai: { ...sharedOptions },
    deepseek: { ...sharedOptions },
    xai: { ...sharedOptions },
  };
}

export function resolveAiRuntime(input: ResolveAiRuntimeInput): ResolvedAiRuntime {
  const resolved = resolveChatRuntimeConfig({
    projectId: input.projectId,
    chatPresetId: input.chatPresetId,
    override: input.override,
  });

  return {
    model: buildChatLanguageModel({
      providerId: resolved.providerId,
      modelId: resolved.modelId,
      baseURL: resolved.baseURL,
      apiKey: resolved.apiKey,
      customUserAgent: resolved.customUserAgent,
      apiFormat: resolved.apiFormat,
    }),
    callSettings: {
      temperature: resolved.temperature,
      maxOutputTokens: resolveMaxOutputTokens(resolved),
      providerOptions: resolveProviderOptions(resolved),
    },
    resolved,
  };
}

export function isValidChatApiFormat(value: unknown): value is ChatApiFormat {
  return value === "chat_completions" || value === "responses";
}
