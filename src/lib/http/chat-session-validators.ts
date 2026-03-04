import type { UIMessage } from "ai";

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

export type ChatSessionScopeInput = {
  projectId: string;
};

export type CreateChatSessionInput = {
  projectId: string;
  chapterId: string | null;
  title: string;
  messages: UIMessage[];
  chatTerminated: boolean;
};

export type PatchChatSessionInput = {
  title?: string;
  messages?: UIMessage[];
  chatTerminated?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeChapterId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isUiMessageLike(value: unknown): value is UIMessage {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.role !== "string") {
    return false;
  }
  if (!Array.isArray(value.parts)) {
    return false;
  }
  return value.parts.length > 0;
}

function validateUiMessages(value: unknown): ValidationResult<UIMessage[]> {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "messages must be an array",
    };
  }

  for (const item of value) {
    if (!isUiMessageLike(item)) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "messages contains invalid message payload",
      };
    }
  }

  return {
    ok: true,
    data: value as UIMessage[],
  };
}

export function validateChatSessionScope(input: {
  projectId: string | null;
}): ValidationResult<ChatSessionScopeInput> {
  if (!isNonEmptyString(input.projectId)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "projectId is required",
    };
  }

  return {
    ok: true,
    data: {
      projectId: input.projectId.trim(),
    },
  };
}

export function validateCreateChatSessionInput(payload: unknown): ValidationResult<CreateChatSessionInput> {
  if (!isRecord(payload)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Body must be an object",
    };
  }

  if (!isNonEmptyString(payload.projectId)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "projectId is required",
    };
  }

  const title = isNonEmptyString(payload.title) ? payload.title.trim() : "新会话";
  const chapterId = normalizeChapterId(payload.chapterId);

  let messages: UIMessage[] = [];
  if (payload.messages !== undefined) {
    const validatedMessages = validateUiMessages(payload.messages);
    if (!validatedMessages.ok) {
      return validatedMessages;
    }
    messages = validatedMessages.data;
  }

  if (payload.chatTerminated !== undefined && typeof payload.chatTerminated !== "boolean") {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "chatTerminated must be boolean when provided",
    };
  }

  return {
    ok: true,
    data: {
      projectId: payload.projectId.trim(),
      chapterId,
      title,
      messages,
      chatTerminated: payload.chatTerminated === true,
    },
  };
}

export function validatePatchChatSessionInput(payload: unknown): ValidationResult<PatchChatSessionInput> {
  if (!isRecord(payload)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Body must be an object",
    };
  }

  const output: PatchChatSessionInput = {};

  if (payload.title !== undefined) {
    if (!isNonEmptyString(payload.title)) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "title must be a non-empty string when provided",
      };
    }
    output.title = payload.title.trim();
  }

  if (payload.messages !== undefined) {
    const validatedMessages = validateUiMessages(payload.messages);
    if (!validatedMessages.ok) {
      return validatedMessages;
    }
    output.messages = validatedMessages.data;
  }

  if (payload.chatTerminated !== undefined) {
    if (typeof payload.chatTerminated !== "boolean") {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "chatTerminated must be boolean when provided",
      };
    }
    output.chatTerminated = payload.chatTerminated;
  }

  if (Object.keys(output).length === 0) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "At least one patch field is required",
    };
  }

  return {
    ok: true,
    data: output,
  };
}
