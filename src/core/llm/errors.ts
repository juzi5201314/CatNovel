export type LlmErrorCode =
  | "LLM_ABORTED"
  | "LLM_TIMEOUT"
  | "LLM_NETWORK_ERROR"
  | "LLM_CONFIG_ERROR"
  | "LLM_INVALID_REQUEST"
  | "LLM_AUTH_ERROR"
  | "LLM_RATE_LIMIT"
  | "LLM_PROVIDER_ERROR"
  | "LLM_BAD_RESPONSE";

type LlmRuntimeErrorOptions = {
  code: LlmErrorCode;
  message: string;
  retryable: boolean;
  status?: number;
  details?: unknown;
  cause?: unknown;
};

export class LlmRuntimeError extends Error {
  readonly code: LlmErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  readonly details?: unknown;
  override readonly cause?: unknown;

  constructor(options: LlmRuntimeErrorOptions) {
    super(options.message);
    this.name = "LlmRuntimeError";
    this.code = options.code;
    this.retryable = options.retryable;
    this.status = options.status;
    this.details = options.details;
    this.cause = options.cause;
  }
}

export function isLlmRuntimeError(error: unknown): error is LlmRuntimeError {
  return error instanceof LlmRuntimeError;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function normalizeAttemptError(
  error: unknown,
  context: {
    abortedByCaller: boolean;
    timedOut: boolean;
  },
): LlmRuntimeError {
  if (isLlmRuntimeError(error)) {
    return error;
  }

  if (isAbortError(error)) {
    if (context.abortedByCaller) {
      return new LlmRuntimeError({
        code: "LLM_ABORTED",
        message: "请求已中断",
        retryable: false,
        cause: error,
      });
    }
    if (context.timedOut) {
      return new LlmRuntimeError({
        code: "LLM_TIMEOUT",
        message: "模型请求超时",
        retryable: true,
        cause: error,
      });
    }
    return new LlmRuntimeError({
      code: "LLM_ABORTED",
      message: "请求已中断",
      retryable: false,
      cause: error,
    });
  }

  if (error instanceof TypeError) {
    return new LlmRuntimeError({
      code: "LLM_NETWORK_ERROR",
      message: "模型服务网络错误",
      retryable: true,
      cause: error,
    });
  }

  return new LlmRuntimeError({
    code: "LLM_PROVIDER_ERROR",
    message: error instanceof Error ? error.message : "模型服务异常",
    retryable: false,
    cause: error,
  });
}

export function toStreamErrorPayload(error: unknown): {
  code: string;
  message: string;
  retryable?: boolean;
} {
  if (isLlmRuntimeError(error)) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    };
  }

  if (error instanceof Error) {
    return {
      code: "STREAM_ERROR",
      message: error.message,
      retryable: false,
    };
  }

  return {
    code: "STREAM_ERROR",
    message: "unknown_error",
    retryable: false,
  };
}
