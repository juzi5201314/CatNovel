import { resolveChatRuntimeConfig } from "./config-resolver";
import { LlmRuntimeError, normalizeAttemptError } from "./errors";
import type {
  ChatApiFormat,
  ChatMessage,
  ResolvedLlmConfig,
  StreamTextRequest,
} from "./types";

const DEFAULT_REQUEST_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 500;
const MAX_ERROR_BODY_LENGTH = 500;

type SseFrame = {
  event?: string;
  data: string;
};

function readIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function buildEndpoint(baseURL: string, apiFormat: ChatApiFormat): string {
  const normalized = baseURL.replace(/\/+$/, "");
  if (apiFormat === "responses") {
    return normalized.endsWith("/responses") ? normalized : `${normalized}/responses`;
  }
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
}

function serializeMessages(messages: ChatMessage[]): Array<{ role: string; content: string }> {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function buildChatCompletionsPayload(
  config: ResolvedLlmConfig,
  messages: ChatMessage[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: config.modelId,
    stream: true,
    messages: serializeMessages(messages),
  };

  if (typeof config.temperature === "number") {
    payload.temperature = config.temperature;
  }

  const tokenBudget =
    config.thinkingBudget?.type === "tokens" ? config.thinkingBudget.tokens : config.maxTokens;
  if (tokenBudget) {
    payload.max_tokens = tokenBudget;
  }

  if (config.thinkingBudget?.type === "tokens") {
    payload.max_completion_tokens = config.thinkingBudget.tokens;
  }

  if (config.thinkingBudget?.type === "effort") {
    payload.reasoning_effort = config.thinkingBudget.effort;
  }

  return payload;
}

function buildResponsesPayload(
  config: ResolvedLlmConfig,
  messages: ChatMessage[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: config.modelId,
    stream: true,
    input: serializeMessages(messages),
  };

  if (typeof config.temperature === "number") {
    payload.temperature = config.temperature;
  }

  const tokenBudget =
    config.thinkingBudget?.type === "tokens" ? config.thinkingBudget.tokens : config.maxTokens;
  if (tokenBudget) {
    payload.max_output_tokens = tokenBudget;
  }

  if (config.thinkingBudget?.type === "effort") {
    payload.reasoning = {
      effort: config.thinkingBudget.effort,
    };
  }

  return payload;
}

function buildRequestPayload(
  config: ResolvedLlmConfig,
  messages: ChatMessage[],
): Record<string, unknown> {
  if (messages.length === 0) {
    throw new LlmRuntimeError({
      code: "LLM_INVALID_REQUEST",
      message: "messages 不能为空",
      retryable: false,
    });
  }

  return config.apiFormat === "responses"
    ? buildResponsesPayload(config, messages)
    : buildChatCompletionsPayload(config, messages);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pushText(parts: string[], value: unknown): void {
  if (typeof value === "string") {
    parts.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      pushText(parts, item);
    }
    return;
  }

  const record = toRecord(value);
  if (!record) {
    return;
  }

  if (typeof record.text === "string") {
    parts.push(record.text);
  }
  if (typeof record.content === "string") {
    parts.push(record.content);
  }
  if (typeof record.delta === "string") {
    parts.push(record.delta);
  }
  if (typeof record.reasoning_content === "string") {
    parts.push(record.reasoning_content);
  }

  if (Array.isArray(record.text)) {
    pushText(parts, record.text);
  }
  if (Array.isArray(record.content)) {
    pushText(parts, record.content);
  }
  if (Array.isArray(record.delta)) {
    pushText(parts, record.delta);
  }
  if (Array.isArray(record.reasoning_content)) {
    pushText(parts, record.reasoning_content);
  }
}

function extractChatCompletionsToken(payload: Record<string, unknown>): string {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const parts: string[] = [];

  for (const item of choices) {
    const choice = toRecord(item);
    if (!choice) {
      continue;
    }

    const delta = toRecord(choice.delta);
    if (delta) {
      pushText(parts, delta.content);
      pushText(parts, delta.reasoning_content);
    }

    pushText(parts, choice.text);
    const message = toRecord(choice.message);
    if (message) {
      pushText(parts, message.content);
    }
  }

  return parts.join("");
}

function extractResponsesToken(payload: Record<string, unknown>): string {
  if (typeof payload.delta === "string") {
    return payload.delta;
  }

  const parts: string[] = [];
  pushText(parts, payload.output_text);

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const record = toRecord(item);
    if (!record) {
      continue;
    }
    pushText(parts, record.content);
    pushText(parts, record.text);
    pushText(parts, record.delta);
  }

  if (parts.length > 0) {
    return parts.join("");
  }

  return extractChatCompletionsToken(payload);
}

function extractToken(
  apiFormat: ChatApiFormat,
  frame: SseFrame,
  payload: Record<string, unknown>,
): string {
  if (apiFormat === "chat_completions") {
    return extractChatCompletionsToken(payload);
  }

  const token = extractResponsesToken(payload);
  if (token.length > 0) {
    return token;
  }

  if (frame.event === "response.output_text.delta" && typeof payload.delta === "string") {
    return payload.delta;
  }

  return "";
}

async function* parseSseFrames(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<SseFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal.aborted) {
        return;
      }

      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");

      while (boundary >= 0) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        let eventName: string | undefined;
        const dataLines: string[] = [];

        for (const line of rawEvent.split("\n")) {
          if (line.startsWith("event:")) {
            eventName = line.slice("event:".length).trim();
            continue;
          }
          if (line.startsWith("data:")) {
            dataLines.push(line.slice("data:".length).trim());
          }
        }

        if (dataLines.length > 0) {
          yield { event: eventName, data: dataLines.join("\n") };
        }

        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function* parseProviderTokens(
  body: ReadableStream<Uint8Array>,
  apiFormat: ChatApiFormat,
  signal: AbortSignal,
): AsyncGenerator<string> {
  for await (const frame of parseSseFrames(body, signal)) {
    if (signal.aborted) {
      return;
    }

    if (frame.data === "[DONE]") {
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(frame.data);
    } catch {
      continue;
    }

    const record = toRecord(payload);
    if (!record) {
      continue;
    }

    const token = extractToken(apiFormat, frame, record);
    if (token.length > 0) {
      yield token;
    }
  }
}

function parseProviderErrorMessage(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const record = toRecord(parsed);
    if (record) {
      const errorRecord = toRecord(record.error);
      if (errorRecord && typeof errorRecord.message === "string") {
        return errorRecord.message;
      }
      if (typeof record.message === "string") {
        return record.message;
      }
      if (typeof record.detail === "string") {
        return record.detail;
      }
    }
  } catch {
    return trimmed.slice(0, MAX_ERROR_BODY_LENGTH);
  }

  return trimmed.slice(0, MAX_ERROR_BODY_LENGTH);
}

async function classifyHttpError(response: Response): Promise<LlmRuntimeError> {
  const rawText = await response.text().catch(() => "");
  const providerMessage = parseProviderErrorMessage(rawText);
  const messageSuffix = providerMessage ? `: ${providerMessage}` : "";

  if (response.status === 401 || response.status === 403) {
    return new LlmRuntimeError({
      code: "LLM_AUTH_ERROR",
      message: `模型服务鉴权失败${messageSuffix}`,
      retryable: false,
      status: response.status,
    });
  }

  if (response.status === 429) {
    return new LlmRuntimeError({
      code: "LLM_RATE_LIMIT",
      message: `模型服务限流${messageSuffix}`,
      retryable: true,
      status: response.status,
    });
  }

  if (response.status >= 500) {
    return new LlmRuntimeError({
      code: "LLM_PROVIDER_ERROR",
      message: `模型服务异常(${response.status})${messageSuffix}`,
      retryable: true,
      status: response.status,
    });
  }

  return new LlmRuntimeError({
    code: "LLM_INVALID_REQUEST",
    message: `模型请求被拒绝(${response.status})${messageSuffix}`,
    retryable: false,
    status: response.status,
  });
}

function calculateBackoffMs(baseDelayMs: number, attempt: number): number {
  const exponential = baseDelayMs * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(Math.random() * 200);
  return Math.min(5_000, exponential + jitter);
}

function abortErrorFromSignal(signal: AbortSignal): LlmRuntimeError {
  return new LlmRuntimeError({
    code: "LLM_ABORTED",
    message: "请求已中断",
    retryable: false,
    details: {
      reason: signal.reason,
    },
  });
}

async function sleepWithAbort(delayMs: number, signal: AbortSignal): Promise<void> {
  if (delayMs <= 0) {
    return;
  }
  if (signal.aborted) {
    throw abortErrorFromSignal(signal);
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(abortErrorFromSignal(signal));
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function* streamTextFromProvider(
  request: StreamTextRequest,
): AsyncGenerator<string> {
  const config = resolveChatRuntimeConfig({
    projectId: request.projectId,
    chatPresetId: request.chatPresetId,
    override: request.override,
  });

  const endpoint = buildEndpoint(config.baseURL, config.apiFormat);
  const payload = buildRequestPayload(config, request.messages);
  const requestTimeoutMs = readIntEnv(
    "LLM_STREAM_TIMEOUT_MS",
    DEFAULT_REQUEST_TIMEOUT_MS,
    5_000,
    300_000,
  );
  const maxRetries = readIntEnv("LLM_STREAM_MAX_RETRIES", DEFAULT_MAX_RETRIES, 0, 5);
  const retryBaseMs = readIntEnv("LLM_STREAM_RETRY_BASE_MS", DEFAULT_RETRY_BASE_MS, 100, 10_000);
  const maxAttempts = maxRetries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (request.signal.aborted) {
      throw abortErrorFromSignal(request.signal);
    }

    const attemptController = new AbortController();
    let timedOut = false;
    let emittedAnyToken = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      attemptController.abort();
    }, requestTimeoutMs);

    const abortRelay = () => {
      attemptController.abort();
    };
    request.signal.addEventListener("abort", abortRelay, { once: true });

    try {
      console.info("[llm] provider_request_start", {
        requestTag: request.requestTag,
        attempt,
        maxAttempts,
        endpoint,
        providerId: config.providerId,
        apiFormat: config.apiFormat,
        modelId: config.modelId,
        messageCount: request.messages.length,
      });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: attemptController.signal,
      });

      if (!response.ok) {
        throw await classifyHttpError(response);
      }

      if (!response.body) {
        throw new LlmRuntimeError({
          code: "LLM_BAD_RESPONSE",
          message: "模型服务未返回流数据",
          retryable: true,
        });
      }

      for await (const token of parseProviderTokens(
        response.body,
        config.apiFormat,
        attemptController.signal,
      )) {
        if (token.length === 0) {
          continue;
        }
        emittedAnyToken = true;
        yield token;
      }

      console.info("[llm] provider_request_done", {
        requestTag: request.requestTag,
        attempt,
        providerId: config.providerId,
        modelId: config.modelId,
        emittedAnyToken,
      });
      return;
    } catch (error) {
      const normalized = normalizeAttemptError(error, {
        abortedByCaller: request.signal.aborted,
        timedOut,
      });

      if (normalized.code === "LLM_ABORTED") {
        throw normalized;
      }

      if (emittedAnyToken) {
        console.error("[llm] stream_failed_after_partial_output", {
          requestTag: request.requestTag,
          attempt,
          code: normalized.code,
          message: normalized.message,
        });
        throw new LlmRuntimeError({
          code: normalized.code,
          message: normalized.message,
          retryable: false,
          status: normalized.status,
          details: normalized.details,
          cause: normalized,
        });
      }

      const canRetry = normalized.retryable && attempt < maxAttempts;
      if (canRetry) {
        const backoffMs = calculateBackoffMs(retryBaseMs, attempt);
        console.warn("[llm] provider_request_retry", {
          requestTag: request.requestTag,
          attempt,
          nextAttempt: attempt + 1,
          backoffMs,
          code: normalized.code,
          message: normalized.message,
        });
        await sleepWithAbort(backoffMs, request.signal);
        continue;
      }

      console.error("[llm] provider_request_failed", {
        requestTag: request.requestTag,
        attempt,
        code: normalized.code,
        message: normalized.message,
        status: normalized.status,
      });
      throw normalized;
    } finally {
      clearTimeout(timeoutId);
      request.signal.removeEventListener("abort", abortRelay);
    }
  }

  throw new LlmRuntimeError({
    code: "LLM_PROVIDER_ERROR",
    message: "模型请求失败",
    retryable: false,
  });
}
