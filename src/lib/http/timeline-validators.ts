import type { ValidationResult } from "./validators";

export const TIMELINE_EVENT_STATUSES = [
  "auto",
  "confirmed",
  "rejected",
  "pending_review",
] as const;
export const TIMELINE_EVENT_ACTIONS = ["confirm", "reject", "edit"] as const;

export type TimelineEventStatus = (typeof TIMELINE_EVENT_STATUSES)[number];
export type TimelineEventAction = (typeof TIMELINE_EVENT_ACTIONS)[number];

export type TimelineEvent = {
  eventId: string;
  entityId: string;
  chapterNo: number;
  title: string;
  description: string;
  confidence: number;
  status: TimelineEventStatus;
  chapterId?: string;
  evidenceSnippet?: string;
};

export type TimelineEntity = {
  entityId: string;
  projectId?: string;
  name: string;
  type?: string;
};

export type ExtractTimelineInput = {
  projectId: string;
  chapterId?: string;
  force: boolean;
};

export type EditTimelineEventPayload = Partial<
  Pick<
    TimelineEvent,
    "entityId" | "chapterId" | "chapterNo" | "title" | "description" | "confidence" | "status"
  > & { evidenceSnippet: string }
>;

export type PatchTimelineEventInput = {
  action: TimelineEventAction;
  payload?: EditTimelineEventPayload;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(
  source: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function readNumber(source: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function isTimelineStatus(value: unknown): value is TimelineEventStatus {
  return (
    typeof value === "string" &&
    (TIMELINE_EVENT_STATUSES as readonly string[]).includes(value)
  );
}

function normalizeTimelineStatus(value: unknown): TimelineEventStatus | undefined {
  if (value === "pendingReview") {
    return "pending_review";
  }
  return isTimelineStatus(value) ? value : undefined;
}

export function validateTimelineEntityIdParam(entityId: unknown): ValidationResult<string> {
  if (typeof entityId !== "string" || entityId.trim().length === 0) {
    return {
      ok: false,
      code: "INVALID_PARAM",
      message: "entityId is required",
    };
  }
  return { ok: true, data: entityId.trim() };
}

export function validateTimelineEventIdParam(eventId: unknown): ValidationResult<string> {
  if (typeof eventId !== "string" || eventId.trim().length === 0) {
    return {
      ok: false,
      code: "INVALID_PARAM",
      message: "eventId is required",
    };
  }
  return { ok: true, data: eventId.trim() };
}

export function validateTimelineEntitiesQuery(
  searchParams: URLSearchParams,
): ValidationResult<{ projectId: string }> {
  const projectId = searchParams.get("projectId");
  if (!projectId || projectId.trim().length === 0) {
    return {
      ok: false,
      code: "INVALID_QUERY",
      message: "projectId is required",
    };
  }
  return {
    ok: true,
    data: {
      projectId: projectId.trim(),
    },
  };
}

export function validateTimelineExtractInput(payload: unknown): ValidationResult<ExtractTimelineInput> {
  if (!isRecord(payload)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Body must be an object",
    };
  }

  const projectId = payload.projectId;
  const chapterId = payload.chapterId;
  const force = payload.force;

  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "projectId is required",
    };
  }

  if (chapterId !== undefined && (typeof chapterId !== "string" || chapterId.trim().length === 0)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "chapterId must be a non-empty string when provided",
    };
  }

  if (force !== undefined && typeof force !== "boolean") {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "force must be boolean when provided",
    };
  }

  return {
    ok: true,
    data: {
      projectId: projectId.trim(),
      chapterId: typeof chapterId === "string" ? chapterId.trim() : undefined,
      force: force ?? false,
    },
  };
}

export function validatePatchTimelineEventInput(
  payload: unknown,
): ValidationResult<PatchTimelineEventInput> {
  if (!isRecord(payload)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Body must be an object",
    };
  }

  const action = payload.action;
  if (typeof action !== "string" || !(TIMELINE_EVENT_ACTIONS as readonly string[]).includes(action)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "action must be one of confirm/reject/edit",
    };
  }

  if (action !== "edit") {
    if (payload.payload !== undefined) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "payload is only allowed when action=edit",
      };
    }
    return {
      ok: true,
      data: {
        action: action as TimelineEventAction,
      },
    };
  }

  if (!isRecord(payload.payload)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "payload must be an object when action=edit",
    };
  }

  const editPayload: EditTimelineEventPayload = {};
  const inputPayload = payload.payload;

  if (inputPayload.entityId !== undefined) {
    if (typeof inputPayload.entityId !== "string" || inputPayload.entityId.trim().length === 0) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "payload.entityId must be a non-empty string",
      };
    }
    editPayload.entityId = inputPayload.entityId.trim();
  }

  if (inputPayload.chapterId !== undefined) {
    if (typeof inputPayload.chapterId !== "string" || inputPayload.chapterId.trim().length === 0) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "payload.chapterId must be a non-empty string",
      };
    }
    editPayload.chapterId = inputPayload.chapterId.trim();
  }

  if (inputPayload.chapterNo !== undefined) {
    if (!Number.isInteger(inputPayload.chapterNo) || (inputPayload.chapterNo as number) < 1) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "payload.chapterNo must be an integer greater than 0",
      };
    }
    editPayload.chapterNo = inputPayload.chapterNo as number;
  }

  if (inputPayload.title !== undefined) {
    if (typeof inputPayload.title !== "string" || inputPayload.title.trim().length === 0) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "payload.title must be a non-empty string",
      };
    }
    editPayload.title = inputPayload.title.trim();
  }

  if (inputPayload.description !== undefined) {
    if (
      typeof inputPayload.description !== "string" ||
      inputPayload.description.trim().length === 0
    ) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "payload.description must be a non-empty string",
      };
    }
    editPayload.description = inputPayload.description.trim();
  }

  if (inputPayload.evidenceSnippet !== undefined) {
    if (typeof inputPayload.evidenceSnippet !== "string") {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "payload.evidenceSnippet must be a string",
      };
    }
    editPayload.evidenceSnippet = inputPayload.evidenceSnippet;
  }

  if (inputPayload.confidence !== undefined) {
    if (
      typeof inputPayload.confidence !== "number" ||
      !Number.isFinite(inputPayload.confidence) ||
      inputPayload.confidence < 0 ||
      inputPayload.confidence > 1
    ) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "payload.confidence must be a number between 0 and 1",
      };
    }
    editPayload.confidence = inputPayload.confidence;
  }

  if (inputPayload.status !== undefined) {
    if (!isTimelineStatus(inputPayload.status)) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "payload.status must be one of auto/confirmed/rejected/pending_review",
      };
    }
    editPayload.status = inputPayload.status;
  }

  if (Object.keys(editPayload).length === 0) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "payload must contain at least one editable field",
    };
  }

  return {
    ok: true,
    data: {
      action: "edit",
      payload: editPayload,
    },
  };
}

export function normalizeTimelineEvent(input: unknown): TimelineEvent | null {
  if (!isRecord(input)) {
    return null;
  }

  const source = isRecord(input.event) ? input.event : input;

  const eventId = readString(source, "eventId", "event_id", "id");
  const chapterNo = readNumber(source, "chapterNo", "chapter_no", "chapterOrder", "chapter_order");
  const title = readString(source, "title");
  const description = readString(source, "description", "summary", "content");
  const confidence = readNumber(source, "confidence");
  const status = normalizeTimelineStatus(source.status);

  let entityId = readString(source, "entityId", "entity_id");
  if (!entityId) {
    entityId = readString(input, "entityId", "entity_id");
  }
  if (!entityId && Array.isArray(input.entityIds)) {
    const firstEntityId = input.entityIds.find(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
    entityId = firstEntityId?.trim();
  }

  if (!eventId || !entityId || chapterNo === undefined || !Number.isInteger(chapterNo)) {
    return null;
  }
  if (!title || !description) {
    return null;
  }
  if (confidence === undefined || confidence < 0 || confidence > 1 || !status) {
    return null;
  }

  const chapterId = readString(source, "chapterId", "chapter_id");
  const evidenceSnippet =
    typeof source.evidenceSnippet === "string"
      ? source.evidenceSnippet
      : typeof source.evidence_snippet === "string"
        ? source.evidence_snippet
        : typeof source.evidence === "string"
          ? source.evidence
        : undefined;

  return {
    eventId,
    entityId,
    chapterNo,
    title,
    description,
    confidence,
    status,
    chapterId,
    evidenceSnippet,
  };
}

export function normalizeTimelineEvents(input: unknown): TimelineEvent[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => normalizeTimelineEvent(item))
    .filter((item): item is TimelineEvent => item !== null);
}

export function normalizeTimelineEntity(input: unknown): TimelineEntity | null {
  if (!isRecord(input)) {
    return null;
  }

  const entityId = readString(input, "entityId", "id");
  const name = readString(input, "name");
  if (!entityId || !name) {
    return null;
  }

  const projectId = readString(input, "projectId", "project_id");
  const type = readString(input, "type");

  return {
    entityId,
    projectId,
    name,
    type,
  };
}

export function normalizeTimelineEntities(input: unknown): TimelineEntity[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => normalizeTimelineEntity(item))
    .filter((item): item is TimelineEntity => item !== null);
}

export function normalizeTimelineAliases(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const aliases: string[] = [];
  for (const item of input) {
    if (typeof item === "string" && item.trim().length > 0) {
      aliases.push(item.trim());
      continue;
    }
    if (!isRecord(item)) {
      continue;
    }
    const alias = readString(item, "alias", "name", "value");
    if (alias) {
      aliases.push(alias);
    }
  }

  return aliases;
}
