"use client";

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: ApiError;
};

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export type ProviderProtocol = "openai_compatible" | "openai_responses";
export type ProviderCategory = "chat" | "embedding" | "both";

export type ProviderConfig = {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  category: ProviderCategory;
  baseURL: string;
  enabled: boolean;
  isBuiltin: boolean;
  builtinCode?: string | null;
  hasApiKey: boolean;
};

export type ThinkingBudget =
  | { type: "effort"; effort: "low" | "medium" | "high" }
  | { type: "tokens"; tokens: number };

export type PresetPurpose = "chat" | "embedding";
export type PresetChatApiFormat = "chat_completions" | "responses";

export type ModelPreset = {
  id: string;
  providerId: string;
  purpose: PresetPurpose;
  chatApiFormat?: PresetChatApiFormat | null;
  modelId: string;
  customUserAgent?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  thinkingBudget?: ThinkingBudget;
  isBuiltin: boolean;
};

export type ProjectSummary = {
  id: string;
  name: string;
  mode: "webnovel" | "literary" | "screenplay";
};

export async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error("响应解析失败");
  }

  if (!response.ok || !payload.success) {
    const message = payload && !payload.success ? payload.error.message : "请求失败";
    throw new Error(message);
  }

  return payload.data;
}
