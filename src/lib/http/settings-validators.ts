import {
  MODEL_API_FORMATS,
  MODEL_PRESET_PURPOSES,
  PROVIDER_CATEGORIES,
  PROVIDER_PROTOCOLS,
  THINKING_BUDGET_TYPES,
  THINKING_EFFORT_LEVELS,
  type ModelApiFormat,
  type ModelPresetPurpose,
  type ProviderCategory,
  type ProviderProtocol,
  type ThinkingBudgetType,
  type ThinkingEffortLevel,
} from "@/db/schema";

type ValidationSuccess<T> = {
  ok: true;
  data: T;
};

type ValidationFailure = {
  ok: false;
  code: string;
  message: string;
  details?: unknown;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export type ThinkingBudgetInput =
  | { type: "effort"; effort: ThinkingEffortLevel }
  | { type: "tokens"; tokens: number };

export type CreateProviderInput = {
  name: string;
  protocol: ProviderProtocol;
  category: ProviderCategory;
  baseURL: string;
  apiKey?: string;
  enabled?: boolean;
};

export type PatchProviderInput = Partial<CreateProviderInput>;

export type CreateModelPresetInput = {
  providerId: string;
  purpose: ModelPresetPurpose;
  apiFormat: ModelApiFormat;
  modelId: string;
  temperature?: number;
  maxTokens?: number;
  thinkingBudget?: ThinkingBudgetInput;
  isBuiltin?: boolean;
};

export type PatchModelPresetInput = Partial<CreateModelPresetInput>;

export type PatchLlmDefaultsInput = {
  projectId: string;
  defaultChatPresetId?: string | null;
  defaultEmbeddingPresetId?: string | null;
};

export type RotateKeyInput = {
  apiKey: string;
};

function asObject(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  return payload as Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isProtocol(value: unknown): value is ProviderProtocol {
  return typeof value === "string" && PROVIDER_PROTOCOLS.includes(value as ProviderProtocol);
}

function isCategory(value: unknown): value is ProviderCategory {
  return typeof value === "string" && PROVIDER_CATEGORIES.includes(value as ProviderCategory);
}

function isPurpose(value: unknown): value is ModelPresetPurpose {
  return typeof value === "string" && MODEL_PRESET_PURPOSES.includes(value as ModelPresetPurpose);
}

function isApiFormat(value: unknown): value is ModelApiFormat {
  return typeof value === "string" && MODEL_API_FORMATS.includes(value as ModelApiFormat);
}

function validateThinkingBudget(value: unknown): ValidationResult<ThinkingBudgetInput | undefined> {
  if (value === undefined) {
    return { ok: true, data: undefined };
  }

  const record = asObject(value);
  if (!record) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "thinkingBudget must be an object",
    };
  }

  const type = record.type;
  if (
    typeof type !== "string" ||
    !THINKING_BUDGET_TYPES.includes(type as ThinkingBudgetType)
  ) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "thinkingBudget.type must be effort or tokens",
    };
  }

  if (type === "effort") {
    const effort = record.effort;
    if (
      typeof effort !== "string" ||
      !THINKING_EFFORT_LEVELS.includes(effort as ThinkingEffortLevel)
    ) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "thinkingBudget.effort must be low/medium/high",
      };
    }
    return { ok: true, data: { type: "effort", effort: effort as ThinkingEffortLevel } };
  }

  const tokens = record.tokens;
  if (!Number.isInteger(tokens) || (tokens as number) <= 0) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "thinkingBudget.tokens must be a positive integer",
    };
  }
  return { ok: true, data: { type: "tokens", tokens: tokens as number } };
}

export function validateCreateProviderInput(payload: unknown): ValidationResult<CreateProviderInput> {
  const record = asObject(payload);
  if (!record) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Body must be an object",
    };
  }

  if (!isNonEmptyString(record.name)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "name is required",
    };
  }

  if (!isProtocol(record.protocol)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "protocol must be openai_compatible/openai_responses",
    };
  }

  if (!isCategory(record.category)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "category must be chat/embedding/both",
    };
  }

  if (!isNonEmptyString(record.baseURL)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "baseURL is required",
    };
  }

  if (record.enabled !== undefined && typeof record.enabled !== "boolean") {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "enabled must be boolean",
    };
  }

  if (record.apiKey !== undefined && !isNonEmptyString(record.apiKey)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "apiKey must be a non-empty string",
    };
  }

  return {
    ok: true,
    data: {
      name: record.name.trim(),
      protocol: record.protocol,
      category: record.category,
      baseURL: record.baseURL.trim(),
      apiKey: typeof record.apiKey === "string" ? record.apiKey : undefined,
      enabled: typeof record.enabled === "boolean" ? record.enabled : undefined,
    },
  };
}

export function validatePatchProviderInput(payload: unknown): ValidationResult<PatchProviderInput> {
  const record = asObject(payload);
  if (!record) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Body must be an object",
    };
  }

  const hasAnyField =
    "name" in record ||
    "protocol" in record ||
    "category" in record ||
    "baseURL" in record ||
    "enabled" in record ||
    "apiKey" in record;

  if (!hasAnyField) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "No updatable fields provided",
    };
  }

  const output: PatchProviderInput = {};

  if ("name" in record) {
    if (!isNonEmptyString(record.name)) {
      return { ok: false, code: "INVALID_INPUT", message: "name must be non-empty string" };
    }
    output.name = record.name.trim();
  }

  if ("protocol" in record) {
    if (!isProtocol(record.protocol)) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "protocol must be openai_compatible/openai_responses",
      };
    }
    output.protocol = record.protocol;
  }

  if ("category" in record) {
    if (!isCategory(record.category)) {
      return { ok: false, code: "INVALID_INPUT", message: "category must be chat/embedding/both" };
    }
    output.category = record.category;
  }

  if ("baseURL" in record) {
    if (!isNonEmptyString(record.baseURL)) {
      return { ok: false, code: "INVALID_INPUT", message: "baseURL must be non-empty string" };
    }
    output.baseURL = record.baseURL.trim();
  }

  if ("enabled" in record) {
    if (typeof record.enabled !== "boolean") {
      return { ok: false, code: "INVALID_INPUT", message: "enabled must be boolean" };
    }
    output.enabled = record.enabled;
  }

  if ("apiKey" in record) {
    if (!isNonEmptyString(record.apiKey)) {
      return { ok: false, code: "INVALID_INPUT", message: "apiKey must be non-empty string" };
    }
    output.apiKey = record.apiKey;
  }

  return { ok: true, data: output };
}

function validateFormatByPurpose(
  purpose: ModelPresetPurpose,
  apiFormat: ModelApiFormat,
): ValidationFailure | null {
  if (purpose === "embedding" && apiFormat !== "embeddings") {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "embedding preset must use embeddings apiFormat",
    };
  }

  if (purpose === "chat" && apiFormat === "embeddings") {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "chat preset must use chat_completions/responses apiFormat",
    };
  }

  return null;
}

export function validateCreateModelPresetInput(
  payload: unknown,
): ValidationResult<CreateModelPresetInput> {
  const record = asObject(payload);
  if (!record) {
    return { ok: false, code: "INVALID_INPUT", message: "Body must be an object" };
  }

  if (!isNonEmptyString(record.providerId)) {
    return { ok: false, code: "INVALID_INPUT", message: "providerId is required" };
  }

  if (!isPurpose(record.purpose)) {
    return { ok: false, code: "INVALID_INPUT", message: "purpose must be chat/embedding" };
  }

  if (!isApiFormat(record.apiFormat)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "apiFormat must be chat_completions/responses/embeddings",
    };
  }

  const formatError = validateFormatByPurpose(record.purpose, record.apiFormat);
  if (formatError) {
    return formatError;
  }

  if (!isNonEmptyString(record.modelId)) {
    return { ok: false, code: "INVALID_INPUT", message: "modelId is required" };
  }

  if (record.temperature !== undefined && typeof record.temperature !== "number") {
    return { ok: false, code: "INVALID_INPUT", message: "temperature must be number" };
  }

  if (
    record.maxTokens !== undefined &&
    (!Number.isInteger(record.maxTokens) || (record.maxTokens as number) <= 0)
  ) {
    return { ok: false, code: "INVALID_INPUT", message: "maxTokens must be positive integer" };
  }

  const thinkingBudgetResult = validateThinkingBudget(record.thinkingBudget);
  if (!thinkingBudgetResult.ok) {
    return thinkingBudgetResult;
  }

  return {
    ok: true,
    data: {
      providerId: record.providerId.trim(),
      purpose: record.purpose,
      apiFormat: record.apiFormat,
      modelId: record.modelId.trim(),
      temperature: record.temperature as number | undefined,
      maxTokens: record.maxTokens as number | undefined,
      thinkingBudget: thinkingBudgetResult.data,
      isBuiltin: typeof record.isBuiltin === "boolean" ? record.isBuiltin : undefined,
    },
  };
}

export function validatePatchModelPresetInput(
  payload: unknown,
): ValidationResult<PatchModelPresetInput> {
  const record = asObject(payload);
  if (!record) {
    return { ok: false, code: "INVALID_INPUT", message: "Body must be an object" };
  }

  const output: PatchModelPresetInput = {};

  if ("providerId" in record) {
    if (!isNonEmptyString(record.providerId)) {
      return { ok: false, code: "INVALID_INPUT", message: "providerId must be non-empty string" };
    }
    output.providerId = record.providerId.trim();
  }

  if ("purpose" in record) {
    if (!isPurpose(record.purpose)) {
      return { ok: false, code: "INVALID_INPUT", message: "purpose must be chat/embedding" };
    }
    output.purpose = record.purpose;
  }

  if ("apiFormat" in record) {
    if (!isApiFormat(record.apiFormat)) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "apiFormat must be chat_completions/responses/embeddings",
      };
    }
    output.apiFormat = record.apiFormat;
  }

  if ("modelId" in record) {
    if (!isNonEmptyString(record.modelId)) {
      return { ok: false, code: "INVALID_INPUT", message: "modelId must be non-empty string" };
    }
    output.modelId = record.modelId.trim();
  }

  if ("temperature" in record) {
    if (record.temperature !== undefined && typeof record.temperature !== "number") {
      return { ok: false, code: "INVALID_INPUT", message: "temperature must be number" };
    }
    output.temperature = record.temperature as number | undefined;
  }

  if ("maxTokens" in record) {
    if (
      record.maxTokens !== undefined &&
      (!Number.isInteger(record.maxTokens) || (record.maxTokens as number) <= 0)
    ) {
      return { ok: false, code: "INVALID_INPUT", message: "maxTokens must be positive integer" };
    }
    output.maxTokens = record.maxTokens as number | undefined;
  }

  if ("thinkingBudget" in record) {
    const thinkingBudgetResult = validateThinkingBudget(record.thinkingBudget);
    if (!thinkingBudgetResult.ok) {
      return thinkingBudgetResult;
    }
    output.thinkingBudget = thinkingBudgetResult.data;
  }

  if ("isBuiltin" in record) {
    if (typeof record.isBuiltin !== "boolean") {
      return { ok: false, code: "INVALID_INPUT", message: "isBuiltin must be boolean" };
    }
    output.isBuiltin = record.isBuiltin;
  }

  if (Object.keys(output).length === 0) {
    return { ok: false, code: "INVALID_INPUT", message: "No updatable fields provided" };
  }

  const mergedPurpose = output.purpose;
  const mergedApiFormat = output.apiFormat;
  if (mergedPurpose && mergedApiFormat) {
    const formatError = validateFormatByPurpose(mergedPurpose, mergedApiFormat);
    if (formatError) {
      return formatError;
    }
  }

  return { ok: true, data: output };
}

export function validatePatchLlmDefaultsInput(
  payload: unknown,
): ValidationResult<PatchLlmDefaultsInput> {
  const record = asObject(payload);
  if (!record) {
    return { ok: false, code: "INVALID_INPUT", message: "Body must be an object" };
  }

  if (!isNonEmptyString(record.projectId)) {
    return { ok: false, code: "INVALID_INPUT", message: "projectId is required" };
  }

  if (
    record.defaultChatPresetId !== undefined &&
    record.defaultChatPresetId !== null &&
    !isNonEmptyString(record.defaultChatPresetId)
  ) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "defaultChatPresetId must be string or null",
    };
  }

  if (
    record.defaultEmbeddingPresetId !== undefined &&
    record.defaultEmbeddingPresetId !== null &&
    !isNonEmptyString(record.defaultEmbeddingPresetId)
  ) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "defaultEmbeddingPresetId must be string or null",
    };
  }

  return {
    ok: true,
    data: {
      projectId: record.projectId.trim(),
      defaultChatPresetId:
        record.defaultChatPresetId === null
          ? null
          : (record.defaultChatPresetId as string | undefined),
      defaultEmbeddingPresetId:
        record.defaultEmbeddingPresetId === null
          ? null
          : (record.defaultEmbeddingPresetId as string | undefined),
    },
  };
}

export function validateRotateKeyInput(payload: unknown): ValidationResult<RotateKeyInput> {
  const record = asObject(payload);
  if (!record) {
    return { ok: false, code: "INVALID_INPUT", message: "Body must be an object" };
  }

  if (!isNonEmptyString(record.apiKey)) {
    return { ok: false, code: "INVALID_INPUT", message: "apiKey is required" };
  }

  return {
    ok: true,
    data: {
      apiKey: record.apiKey,
    },
  };
}
