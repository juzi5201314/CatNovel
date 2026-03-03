import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { EmbeddingModel, LanguageModel } from "ai";

import type { ChatApiFormat, ProviderProtocol } from "@/db/schema";

export type BuildChatModelInput = {
  providerId: string;
  modelId: string;
  baseURL: string;
  apiKey: string;
  customUserAgent?: string;
  apiFormat: ChatApiFormat;
};

export type BuildEmbeddingModelInput = {
  providerId: string;
  modelId: string;
  baseURL: string;
  apiKey: string;
  customUserAgent?: string;
  providerProtocol: ProviderProtocol;
};

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type CreateFetchOptions = {
  enforceResponsesStore?: boolean;
};

export function normalizeProviderId(providerId: string): string {
  const normalized = providerId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : "openai-compatible";
}

export function normalizeModelBaseUrl(baseURL: string): string {
  const trimmed = baseURL.trim().replace(/\/+$/, "");
  const lowered = trimmed.toLowerCase();
  if (lowered.endsWith("/chat/completions")) {
    return trimmed.slice(0, -"/chat/completions".length);
  }
  if (lowered.endsWith("/responses")) {
    return trimmed.slice(0, -"/responses".length);
  }
  if (lowered.endsWith("/embeddings")) {
    return trimmed.slice(0, -"/embeddings".length);
  }
  return trimmed;
}

function normalizeCustomUserAgent(customUserAgent: string | undefined): string | undefined {
  if (typeof customUserAgent !== "string") {
    return undefined;
  }
  const trimmed = customUserAgent.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function createUserAgentOverrideFetch(
  customUserAgent: string | undefined,
  baseFetch: FetchLike = fetch,
  options?: CreateFetchOptions,
): FetchLike | undefined {
  const normalizedUserAgent = normalizeCustomUserAgent(customUserAgent);
  if (!normalizedUserAgent && !options?.enforceResponsesStore) {
    return undefined;
  }

  return async (input, init) => {
    let request = new Request(input, init);
    if (normalizedUserAgent) {
      request.headers.set("user-agent", normalizedUserAgent);
    }

    if (
      options?.enforceResponsesStore &&
      request.method.toUpperCase() === "POST" &&
      request.headers.get("content-type")?.toLowerCase().includes("application/json")
    ) {
      const rawBody = await request.text();
      let nextBody = rawBody;
      try {
        const parsed = JSON.parse(rawBody) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const record = parsed as Record<string, unknown>;
          if (record.store === undefined) {
            record.store = true;
          }
          nextBody = JSON.stringify(record);
        }
      } catch {
        // Keep original body when parse failed.
      }
      request = new Request(request, { body: nextBody });
    }

    return baseFetch(request);
  };
}

export function buildChatLanguageModel(input: BuildChatModelInput): LanguageModel {
  const providerName = normalizeProviderId(input.providerId);
  const baseURL = normalizeModelBaseUrl(input.baseURL);
  const requestFetch = createUserAgentOverrideFetch(input.customUserAgent, fetch, {
    enforceResponsesStore: input.apiFormat === "responses",
  });

  if (input.apiFormat === "responses") {
    return createOpenAI({
      name: providerName,
      apiKey: input.apiKey,
      baseURL,
      fetch: requestFetch,
    }).responses(input.modelId);
  }

  return createOpenAICompatible({
    name: providerName,
    apiKey: input.apiKey,
    baseURL,
    fetch: requestFetch,
  }).chatModel(input.modelId);
}

export function buildEmbeddingModel(input: BuildEmbeddingModelInput): EmbeddingModel {
  if (input.providerProtocol !== "openai_compatible") {
    throw new Error(
      `embedding provider protocol must be openai_compatible, got: ${input.providerProtocol}`,
    );
  }

  const providerName = normalizeProviderId(input.providerId);
  const baseURL = normalizeModelBaseUrl(input.baseURL);
  const requestFetch = createUserAgentOverrideFetch(input.customUserAgent, fetch);

  return createOpenAI({
    name: providerName,
    apiKey: input.apiKey,
    baseURL,
    fetch: requestFetch,
  }).embeddingModel(input.modelId);
}
