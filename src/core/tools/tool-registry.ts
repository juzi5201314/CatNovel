import { TimelineRepository } from "@/repositories/timeline-repository";

export type ToolExecutionInput = {
  projectId: string;
  toolName: string;
  args: unknown;
};

type ToolHandler = (input: ToolExecutionInput) => Promise<unknown>;

type TimelineRepositoryStatus = "auto" | "confirmed" | "rejected" | "pending_review";

type TimelineEntityWithAliases = {
  entity: unknown;
  aliases: unknown;
};

type TimelineEventWithEntities = {
  event: unknown;
  entityIds: string[];
};

type TimelineUpsertInput = {
  id?: string;
  projectId: string;
  chapterId: string;
  chapterOrder: number;
  sequenceNo?: number;
  title: string;
  summary?: string | null;
  evidence?: string | null;
  confidence?: number;
  status?: TimelineRepositoryStatus;
  entityIds: string[];
};

type TimelineEditInput = Partial<Omit<TimelineUpsertInput, "projectId" | "id">> & {
  eventId?: string;
  chapterNo?: number;
  chapterOrder?: number;
  description?: string;
  evidenceSnippet?: string;
  entityId?: string;
};

type TimelineRepositoryPort = {
  listEntitiesByProject(projectId: string): TimelineEntityWithAliases[];
  getTimelineByEntity(projectId: string, entityId: string): TimelineEventWithEntities[];
  upsertEventWithSnapshot(input: TimelineUpsertInput): {
    event: unknown;
    entityIds: string[];
    snapshotId: string;
    conflictResult: unknown;
  };
};

const timelineRepository = new TimelineRepository() as unknown as TimelineRepositoryPort;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asOptionalNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asOptionalInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function asTimelineStatus(value: unknown): TimelineRepositoryStatus | undefined {
  if (
    value === "auto" ||
    value === "confirmed" ||
    value === "rejected" ||
    value === "pending_review"
  ) {
    return value;
  }
  return undefined;
}

function extractEntityId(row: TimelineEntityWithAliases): string | undefined {
  const entity = asRecord(row.entity);
  if (!entity) {
    return undefined;
  }
  return asOptionalNonEmptyString(entity.id);
}

function extractEventId(value: unknown): string | undefined {
  const row = asRecord(value);
  if (!row) {
    return undefined;
  }
  const eventRecord = asRecord(row.event);
  if (eventRecord) {
    return asOptionalNonEmptyString(eventRecord.id) ?? asOptionalNonEmptyString(eventRecord.eventId);
  }
  return asOptionalNonEmptyString(row.id) ?? asOptionalNonEmptyString(row.eventId);
}

function listProjectTimelineEvents(projectId: string, entityId?: string): TimelineEventWithEntities[] {
  if (entityId) {
    return timelineRepository.getTimelineByEntity(projectId, entityId);
  }

  const rows = timelineRepository.listEntitiesByProject(projectId);
  const deduped = new Map<string, TimelineEventWithEntities>();
  for (const row of rows) {
    const currentEntityId = extractEntityId(row);
    if (!currentEntityId) {
      continue;
    }
    const timelineRows = timelineRepository.getTimelineByEntity(projectId, currentEntityId);
    for (const timelineRow of timelineRows) {
      const eventId = extractEventId(timelineRow);
      if (!eventId || deduped.has(eventId)) {
        continue;
      }
      deduped.set(eventId, timelineRow);
    }
  }
  return [...deduped.values()];
}

const handlers: Record<string, ToolHandler> = {
  "rag.search": async ({ args }) => ({
    hits: [],
    query: (args as { query?: string })?.query ?? "",
  }),
  "rag.getEvidence": async () => ({ evidence: [] }),
  "timeline.getEntity": async ({ projectId, args }) => {
    const record = asRecord(args);
    const entityId = asOptionalNonEmptyString(record?.entityId);
    if (!entityId) {
      throw new Error("entityId is required");
    }

    const entities = timelineRepository.listEntitiesByProject(projectId);
    const entityRow = entities.find((row) => extractEntityId(row) === entityId);
    if (!entityRow) {
      return {
        entity: null,
        aliases: [],
        timeline: [],
      };
    }

    return {
      entity: entityRow.entity,
      aliases: entityRow.aliases,
      timeline: timelineRepository.getTimelineByEntity(projectId, entityId),
    };
  },
  "timeline.listEvents": async ({ projectId, args }) => {
    const record = asRecord(args) ?? {};
    const resolvedProjectId = asOptionalNonEmptyString(record.projectId) ?? projectId;
    const entityId = asOptionalNonEmptyString(record.entityId);
    const chapterId = asOptionalNonEmptyString(record.chapterId);
    const status = asOptionalNonEmptyString(record.status);
    const events = listProjectTimelineEvents(resolvedProjectId, entityId).filter((item) => {
      const eventRecord = asRecord(item.event);
      if (!eventRecord) {
        return false;
      }
      if (chapterId && asOptionalNonEmptyString(eventRecord.chapterId) !== chapterId) {
        return false;
      }
      if (status && asOptionalNonEmptyString(eventRecord.status) !== status) {
        return false;
      }
      return true;
    });

    return {
      events,
    };
  },
  "timeline.upsertEvent": async ({ projectId, args }) => {
    const record = asRecord(args);
    if (!record) {
      throw new Error("timeline.upsertEvent args must be an object");
    }

    const entityId = asOptionalNonEmptyString(record.entityId);
    const entityIdsFromArgs = asStringArray(record.entityIds);
    const entityIds = entityIdsFromArgs.length > 0 ? entityIdsFromArgs : entityId ? [entityId] : [];
    const title = asOptionalNonEmptyString(record.title);
    const summary =
      asOptionalNonEmptyString(record.summary) ?? asOptionalNonEmptyString(record.description);
    const chapterId = asOptionalNonEmptyString(record.chapterId);
    const chapterOrder = asOptionalInteger(record.chapterOrder) ?? asOptionalInteger(record.chapterNo);
    const confidence = asOptionalNumber(record.confidence);

    if (!chapterId || !title || chapterOrder === undefined || entityIds.length === 0) {
      throw new Error(
        "timeline.upsertEvent requires chapterId/chapterOrder/title/entityIds",
      );
    }

    const result = timelineRepository.upsertEventWithSnapshot({
      id: asOptionalNonEmptyString(record.id) ?? asOptionalNonEmptyString(record.eventId),
      projectId,
      chapterId,
      chapterOrder,
      sequenceNo: asOptionalInteger(record.sequenceNo),
      title,
      summary,
      evidence:
        asOptionalNonEmptyString(record.evidence) ??
        asOptionalNonEmptyString(record.evidenceSnippet),
      confidence,
      status: asTimelineStatus(record.status),
      entityIds,
    });

    return {
      upserted: true,
      event: result.event,
      entityIds: result.entityIds,
      snapshotId: result.snapshotId,
      conflictResult: result.conflictResult,
    };
  },
  "timeline.editEvent": async ({ projectId, args }) => {
    const record = asRecord(args);
    if (!record) {
      throw new Error("timeline.editEvent args must be an object");
    }

    const eventId = asOptionalNonEmptyString(record.eventId);
    if (!eventId) {
      throw new Error("eventId is required");
    }

    const patchRecord =
      (asRecord(record.patch) as TimelineEditInput | null) ??
      (Object.fromEntries(
        Object.entries(record).filter(([key]) => key !== "eventId"),
      ) as TimelineEditInput);

    if (Object.keys(patchRecord).length === 0) {
      throw new Error("timeline.editEvent patch is required");
    }

    const existing = listProjectTimelineEvents(projectId).find(
      (item) => extractEventId(item) === eventId,
    );
    if (!existing) {
      return {
        edited: false,
        event: null,
      };
    }

    const eventRecord = asRecord(existing.event);
    if (!eventRecord) {
      return {
        edited: false,
        event: null,
      };
    }

    const chapterId =
      asOptionalNonEmptyString((patchRecord as Record<string, unknown>).chapterId) ??
      asOptionalNonEmptyString(eventRecord.chapterId);
    const chapterOrder =
      asOptionalInteger((patchRecord as Record<string, unknown>).chapterOrder) ??
      asOptionalInteger((patchRecord as Record<string, unknown>).chapterNo) ??
      asOptionalInteger(eventRecord.chapterOrder);
    const title =
      asOptionalNonEmptyString((patchRecord as Record<string, unknown>).title) ??
      asOptionalNonEmptyString(eventRecord.title);
    const summary =
      asOptionalNonEmptyString((patchRecord as Record<string, unknown>).summary) ??
      asOptionalNonEmptyString((patchRecord as Record<string, unknown>).description) ??
      asOptionalNonEmptyString(eventRecord.summary);

    if (!chapterId || chapterOrder === undefined || !title) {
      throw new Error("timeline.editEvent cannot resolve required chapterId/chapterOrder/title");
    }

    const entityIds = (() => {
      const explicitEntityIds = asStringArray((patchRecord as Record<string, unknown>).entityIds);
      if (explicitEntityIds.length > 0) {
        return explicitEntityIds;
      }
      const explicitEntityId = asOptionalNonEmptyString(
        (patchRecord as Record<string, unknown>).entityId,
      );
      if (explicitEntityId) {
        return [explicitEntityId];
      }
      const fallbackEntityId = asOptionalNonEmptyString(eventRecord.entityId);
      return existing.entityIds.length > 0
        ? existing.entityIds
        : fallbackEntityId
          ? [fallbackEntityId]
          : [];
    })();

    if (entityIds.length === 0) {
      throw new Error("timeline.editEvent cannot resolve entityIds");
    }

    const result = timelineRepository.upsertEventWithSnapshot({
      id: eventId,
      projectId,
      chapterId,
      chapterOrder,
      sequenceNo:
        asOptionalInteger((patchRecord as Record<string, unknown>).sequenceNo) ??
        asOptionalInteger(eventRecord.sequenceNo),
      title,
      summary,
      evidence:
        asOptionalNonEmptyString((patchRecord as Record<string, unknown>).evidence) ??
        asOptionalNonEmptyString((patchRecord as Record<string, unknown>).evidenceSnippet) ??
        asOptionalNonEmptyString(eventRecord.evidence),
      confidence:
        asOptionalNumber((patchRecord as Record<string, unknown>).confidence) ??
        asOptionalNumber(eventRecord.confidence),
      status:
        asTimelineStatus((patchRecord as Record<string, unknown>).status) ??
        asTimelineStatus(eventRecord.status),
      entityIds,
    });

    return {
      edited: true,
      event: result.event,
      entityIds: result.entityIds,
      snapshotId: result.snapshotId,
      conflictResult: result.conflictResult,
    };
  },
  "lore.upsertNode": async ({ args }) => ({
    upserted: true,
    node: args ?? null,
  }),
  "lore.deleteNode": async ({ args }) => ({
    deleted: true,
    node: args ?? null,
  }),
  "rag.reindex": async ({ args }) => ({
    queued: true,
    request: args ?? null,
  }),
  "settings.providers.rotateKey": async () => ({
    rotated: true,
  }),
  "settings.providers.delete": async () => ({
    deleted: true,
  }),
  "settings.modelPresets.deleteBuiltinLocked": async () => ({
    deleted: true,
  }),
};

export async function executeTool(input: ToolExecutionInput): Promise<unknown> {
  const handler = handlers[input.toolName];
  if (!handler) {
    throw new Error(`unknown tool: ${input.toolName}`);
  }

  return handler(input);
}
