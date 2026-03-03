import type { ProviderProtocol, ThinkingEffort } from "@/db/schema";

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatApiFormat = "chat_completions" | "responses";

export type ThinkingBudget =
  | {
      type: "effort";
      effort: ThinkingEffort;
    }
  | {
      type: "tokens";
      tokens: number;
    };

export type ChatOverride = {
  apiFormat?: ChatApiFormat;
  baseURL?: string;
  modelId?: string;
  thinkingBudget?: unknown;
};

export type ResolveLlmConfigInput = {
  projectId: string;
  chatPresetId?: string;
  override?: ChatOverride;
};

export type ResolvedLlmConfig = {
  presetId: string;
  presetSource: "explicit" | "project_default" | "builtin_default" | "first_available";
  providerId: string;
  providerName: string;
  providerProtocol: ProviderProtocol;
  baseURL: string;
  apiKey: string;
  customUserAgent?: string;
  apiFormat: ChatApiFormat;
  modelId: string;
  temperature?: number;
  maxTokens?: number;
  thinkingBudget?: ThinkingBudget;
};

export type StreamTextRequest = {
  requestTag: "chat" | "generate";
  projectId: string;
  messages: ChatMessage[];
  chatPresetId?: string;
  override?: ChatOverride;
  signal: AbortSignal;
};
