import type { AppDatabase } from "@/db/client";
import { getDatabase } from "@/db/client";
import { llmModelPresets, llmProviders } from "@/db/schema";

const BUILTIN_PROVIDERS = [
  {
    id: "builtin_openai_compatible",
    name: "Custom OpenAI Compatible",
    protocol: "openai_compatible" as const,
    category: "both" as const,
    baseUrl: "https://api.openai-compatible.local/v1",
    enabled: true,
    isBuiltin: true,
    builtinCode: "builtin_openai_compatible",
  },
  {
    id: "builtin_openai_responses",
    name: "Custom OpenAI Responses",
    protocol: "openai_responses" as const,
    category: "chat" as const,
    baseUrl: "https://api.openai-compatible.local/v1",
    enabled: true,
    isBuiltin: true,
    builtinCode: "builtin_openai_responses",
  },
  {
    id: "builtin_deepseek_compatible",
    name: "DeepSeek Official Compatible",
    protocol: "openai_compatible" as const,
    category: "both" as const,
    baseUrl: "https://api.deepseek.com",
    enabled: true,
    isBuiltin: true,
    builtinCode: "builtin_deepseek_compatible",
  },
];

const BUILTIN_PRESETS = [
  {
    id: "preset_chat_completions_default",
    providerId: "builtin_openai_compatible",
    purpose: "chat" as const,
    apiFormat: "chat_completions" as const,
    modelId: "gpt-4.1",
    temperature: 0.7,
    maxTokens: 4096,
    isBuiltin: true,
  },
  {
    id: "preset_responses_default",
    providerId: "builtin_openai_responses",
    purpose: "chat" as const,
    apiFormat: "responses" as const,
    modelId: "gpt-4.1",
    temperature: 0.7,
    maxTokens: 4096,
    isBuiltin: true,
  },
  {
    id: "preset_deepseek_chat",
    providerId: "builtin_deepseek_compatible",
    purpose: "chat" as const,
    apiFormat: "chat_completions" as const,
    modelId: "deepseek-chat",
    temperature: 0.7,
    maxTokens: 8192,
    isBuiltin: true,
  },
  {
    id: "preset_deepseek_reasoner",
    providerId: "builtin_deepseek_compatible",
    purpose: "chat" as const,
    apiFormat: "chat_completions" as const,
    modelId: "deepseek-reasoner",
    thinkingBudgetType: "effort" as const,
    thinkingEffort: "medium" as const,
    isBuiltin: true,
  },
  {
    id: "preset_embedding_default",
    providerId: "builtin_openai_compatible",
    purpose: "embedding" as const,
    apiFormat: "embeddings" as const,
    modelId: "text-embedding-3-large",
    isBuiltin: true,
  },
];

export function seedBuiltinLlmConfig(database?: AppDatabase): void {
  const db = database ?? getDatabase();

  for (const provider of BUILTIN_PROVIDERS) {
    db.insert(llmProviders)
      .values(provider)
      .onConflictDoUpdate({
        target: llmProviders.id,
        set: { ...provider, updatedAt: new Date() },
      })
      .run();
  }

  for (const preset of BUILTIN_PRESETS) {
    db.insert(llmModelPresets)
      .values({
        ...preset,
        temperature: preset.temperature,
      })
      .onConflictDoUpdate({
        target: llmModelPresets.id,
        set: {
          ...preset,
          temperature: preset.temperature,
          updatedAt: new Date(),
        },
      })
      .run();
  }
}
