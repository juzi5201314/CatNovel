import { PROJECT_MODES, type ProjectMode } from "@/db/schema";

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

export type CreateProjectInput = {
  name: string;
  mode: ProjectMode;
};

export type CreateChapterInput = {
  title: string;
  order?: number;
};

export type PatchChapterInput = {
  title?: string;
  content?: string;
  summary?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export function validateCreateProjectInput(payload: unknown): ValidationResult<CreateProjectInput> {
  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Body must be an object",
    };
  }

  const record = payload as Record<string, unknown>;
  const name = record.name;
  const mode = record.mode;

  if (!isNonEmptyString(name)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "name must be a non-empty string",
    };
  }

  if (typeof mode !== "string" || !PROJECT_MODES.includes(mode as ProjectMode)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "mode must be one of webnovel/literary/screenplay",
    };
  }

  return {
    ok: true,
    data: {
      name: name.trim(),
      mode: mode as ProjectMode,
    },
  };
}

export function validateCreateChapterInput(payload: unknown): ValidationResult<CreateChapterInput> {
  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Body must be an object",
    };
  }

  const record = payload as Record<string, unknown>;
  const title = record.title;
  const order = record.order;

  if (!isNonEmptyString(title)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "title must be a non-empty string",
    };
  }

  if (order !== undefined && (!Number.isInteger(order) || (order as number) < 1)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "order must be an integer greater than 0",
    };
  }

  return {
    ok: true,
    data: {
      title: title.trim(),
      order: order as number | undefined,
    },
  };
}

export function validatePatchChapterInput(payload: unknown): ValidationResult<PatchChapterInput> {
  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Body must be an object",
    };
  }

  const record = payload as Record<string, unknown>;
  const { title, content, summary } = record;

  if (!isOptionalString(title) || !isOptionalString(content) || !isOptionalString(summary)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "title/content/summary must be string when provided",
    };
  }

  const data: PatchChapterInput = {};

  if (typeof title === "string") {
    if (!isNonEmptyString(title)) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "title cannot be empty",
      };
    }
    data.title = title.trim();
  }

  if (typeof content === "string") {
    data.content = content;
  }

  if (typeof summary === "string") {
    data.summary = summary;
  }

  if (Object.keys(data).length === 0) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "At least one field is required",
    };
  }

  return { ok: true, data };
}
