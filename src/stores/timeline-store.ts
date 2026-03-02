"use client";

import { create } from "zustand";

type TimelineEventStatus = "auto" | "confirmed" | "rejected" | "pending_review";

export type TimelineEntitySummary = {
  id: string;
  name: string;
  type: string | null;
  aliases: string[];
  eventCount: number;
  pendingReviewCount: number;
  updatedAt: string | null;
};

export type TimelineEventItem = {
  id: string;
  entityId: string;
  chapterNo: number;
  chapterId: string | null;
  title: string;
  description: string;
  confidence: number;
  status: TimelineEventStatus;
  updatedAt: string | null;
};

export type TimelineEntityDetail = {
  entity: TimelineEntitySummary;
  events: TimelineEventItem[];
};

export type TimelineEventEditInput = {
  title?: string;
  description?: string;
  chapterNo?: number;
  confidence?: number;
};

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type ApiResult<T> = ApiSuccess<T> | ApiFailure;

type TimelineStoreState = {
  projectId: string | null;
  entities: TimelineEntitySummary[];
  selectedEntityId: string | null;
  selectedEntity: TimelineEntityDetail | null;
  loadingEntities: boolean;
  loadingEntityDetail: boolean;
  extracting: boolean;
  busyEventId: string | null;
  reviewThreshold: number;
  error: string | null;
  notice: string | null;
  initialize: (projectId: string | null) => Promise<void>;
  fetchEntities: () => Promise<void>;
  selectEntity: (entityId: string) => Promise<void>;
  extractTimeline: (chapterId?: string | null) => Promise<void>;
  confirmEvent: (eventId: string) => Promise<void>;
  rejectEvent: (eventId: string) => Promise<void>;
  editEvent: (eventId: string, input: TimelineEventEditInput) => Promise<void>;
  clearError: () => void;
  clearNotice: () => void;
};

const DEFAULT_REVIEW_THRESHOLD = 0.7;

function normalizeError(reason: unknown, fallback: string): string {
  if (reason instanceof Error) {
    return reason.message;
  }
  if (typeof reason === "string" && reason.trim().length > 0) {
    return reason;
  }
  return fallback;
}

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.success ? "request_failed" : payload.error.message);
  }
  return payload.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function pickStringArray(source: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0);
    }
  }
  return [];
}

function normalizeStatus(raw: string | null): TimelineEventStatus {
  if (
    raw === "confirmed" ||
    raw === "rejected" ||
    raw === "auto" ||
    raw === "pending_review" ||
    raw === "pendingReview"
  ) {
    return raw === "pendingReview" ? "pending_review" : raw;
  }
  return "auto";
}

function normalizeConfidence(raw: number | null): number {
  if (raw === null) {
    return 0.5;
  }
  if (raw < 0) {
    return 0;
  }
  if (raw > 1) {
    return 1;
  }
  return raw;
}

function normalizeEntitySummary(raw: unknown): TimelineEntitySummary | null {
  if (!isRecord(raw)) {
    return null;
  }

  const id = pickString(raw, ["id", "entityId"]);
  if (!id) {
    return null;
  }

  return {
    id,
    name: pickString(raw, ["name", "displayName", "label"]) ?? id,
    type: pickString(raw, ["type", "entityType"]),
    aliases: pickStringArray(raw, ["aliases", "aliasList"]),
    eventCount: pickNumber(raw, ["eventCount", "eventsCount", "count"]) ?? 0,
    pendingReviewCount:
      pickNumber(raw, ["pendingReviewCount", "lowConfidenceCount", "reviewCount"]) ?? 0,
    updatedAt: pickString(raw, ["updatedAt", "updated_at"]),
  };
}

function normalizeEvent(raw: unknown, fallbackEntityId: string): TimelineEventItem | null {
  if (!isRecord(raw)) {
    return null;
  }

  const id = pickString(raw, ["id", "eventId"]);
  if (!id) {
    return null;
  }

  const chapterNo = pickNumber(raw, ["chapterNo", "chapter_no", "orderNo", "chapter"]) ?? 0;
  const entityId = pickString(raw, ["entityId", "entity_id"]) ?? fallbackEntityId;

  return {
    id,
    entityId,
    chapterNo: Math.max(0, Math.trunc(chapterNo)),
    chapterId: pickString(raw, ["chapterId", "chapter_id"]),
    title: pickString(raw, ["title", "name"]) ?? "未命名事件",
    description: pickString(raw, ["description", "detail", "summary"]) ?? "",
    confidence: normalizeConfidence(pickNumber(raw, ["confidence", "score"])),
    status: normalizeStatus(pickString(raw, ["status"])),
    updatedAt: pickString(raw, ["updatedAt", "updated_at"]),
  };
}

function sortEvents(events: TimelineEventItem[]): TimelineEventItem[] {
  return [...events].sort((a, b) => {
    if (a.chapterNo !== b.chapterNo) {
      return a.chapterNo - b.chapterNo;
    }
    if (a.status !== b.status) {
      const rank = (status: TimelineEventStatus) =>
        status === "confirmed" ? 0 : status === "pending_review" ? 1 : status === "auto" ? 2 : 3;
      return rank(a.status) - rank(b.status);
    }
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    return a.title.localeCompare(b.title, "zh-Hans-CN");
  });
}

function sortEntities(entities: TimelineEntitySummary[]): TimelineEntitySummary[] {
  return [...entities].sort((a, b) => {
    if (a.pendingReviewCount !== b.pendingReviewCount) {
      return b.pendingReviewCount - a.pendingReviewCount;
    }
    if (a.eventCount !== b.eventCount) {
      return b.eventCount - a.eventCount;
    }
    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });
}

function normalizeEntityList(raw: unknown): TimelineEntitySummary[] {
  const candidates = (() => {
    if (Array.isArray(raw)) {
      return raw;
    }
    if (!isRecord(raw)) {
      return [];
    }
    if (Array.isArray(raw.entities)) {
      return raw.entities;
    }
    if (Array.isArray(raw.items)) {
      return raw.items;
    }
    return [];
  })();

  return sortEntities(
    candidates
      .map((item) => normalizeEntitySummary(item))
      .filter((item): item is TimelineEntitySummary => item !== null),
  );
}

function normalizeEntityDetail(
  raw: unknown,
  fallbackSummary: TimelineEntitySummary | null,
  fallbackEntityId: string,
): TimelineEntityDetail {
  const payload = isRecord(raw) ? raw : {};

  const entityRaw = isRecord(payload.entity) ? payload.entity : payload;
  const entity =
    normalizeEntitySummary(entityRaw) ??
    fallbackSummary ??
    ({
      id: fallbackEntityId,
      name: fallbackEntityId,
      type: null,
      aliases: [],
      eventCount: 0,
      pendingReviewCount: 0,
      updatedAt: null,
    } satisfies TimelineEntitySummary);

  const rawEvents = (() => {
    if (Array.isArray(payload.events)) {
      return payload.events;
    }
    if (Array.isArray(payload.timeline)) {
      return payload.timeline;
    }
    if (Array.isArray(payload.items)) {
      return payload.items;
    }
    return [];
  })();

  const events = sortEvents(
    rawEvents
      .map((item) => normalizeEvent(item, entity.id))
      .filter((item): item is TimelineEventItem => item !== null),
  );

  return {
    entity: {
      ...entity,
      eventCount: Math.max(entity.eventCount, events.length),
    },
    events,
  };
}

function upsertEntitySummary(
  entities: TimelineEntitySummary[],
  summary: TimelineEntitySummary,
): TimelineEntitySummary[] {
  const next = entities.some((item) => item.id === summary.id)
    ? entities.map((item) => (item.id === summary.id ? { ...item, ...summary } : item))
    : [...entities, summary];

  return sortEntities(next);
}

function resetProjectState() {
  return {
    entities: [],
    selectedEntityId: null,
    selectedEntity: null,
    loadingEntities: false,
    loadingEntityDetail: false,
    extracting: false,
    busyEventId: null,
    error: null,
    notice: null,
  };
}

export const useTimelineStore = create<TimelineStoreState>((set, get) => {
  const refreshAfterMutation = async (successNotice: string) => {
    await get().fetchEntities();
    set({ notice: successNotice });
  };

  const patchEvent = async (
    eventId: string,
    payload: Record<string, unknown>,
    successNotice: string,
    errorFallback: string,
  ) => {
    set({ busyEventId: eventId, error: null, notice: null });

    try {
      const response = await fetch(`/api/timeline/events/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      await readApi<unknown>(response);
      await refreshAfterMutation(successNotice);
    } catch (error) {
      set({ error: normalizeError(error, errorFallback) });
    } finally {
      set({ busyEventId: null });
    }
  };

  const fetchEntityDetail = async (entityId: string) => {
    const contextProjectId = get().projectId;
    if (!contextProjectId) {
      return;
    }

    const currentSelectedId = get().selectedEntityId;
    set({
      selectedEntityId: entityId,
      selectedEntity: currentSelectedId === entityId ? get().selectedEntity : null,
      loadingEntityDetail: true,
      error: null,
    });

    try {
      const response = await fetch(`/api/timeline/entity/${encodeURIComponent(entityId)}`, {
        method: "GET",
      });
      const data = await readApi<unknown>(response);

      if (get().projectId !== contextProjectId) {
        return;
      }

      const fallbackSummary =
        get().entities.find((entity) => entity.id === entityId) ?? null;
      const detail = normalizeEntityDetail(data, fallbackSummary, entityId);

      set({
        loadingEntityDetail: false,
        selectedEntityId: detail.entity.id,
        selectedEntity: detail,
        entities: upsertEntitySummary(get().entities, detail.entity),
      });
    } catch (error) {
      if (get().projectId !== contextProjectId) {
        return;
      }
      set({
        loadingEntityDetail: false,
        error: normalizeError(error, "实体详情加载失败"),
      });
    }
  };

  return {
    projectId: null,
    entities: [],
    selectedEntityId: null,
    selectedEntity: null,
    loadingEntities: false,
    loadingEntityDetail: false,
    extracting: false,
    busyEventId: null,
    reviewThreshold: DEFAULT_REVIEW_THRESHOLD,
    error: null,
    notice: null,

    initialize: async (projectId) => {
      const currentProjectId = get().projectId;
      if (!projectId) {
        set({
          projectId: null,
          ...resetProjectState(),
        });
        return;
      }

      const projectChanged = currentProjectId !== projectId;
      set({
        projectId,
        error: null,
        notice: null,
        ...(projectChanged
          ? {
              entities: [],
              selectedEntityId: null,
              selectedEntity: null,
            }
          : {}),
      });

      await get().fetchEntities();
    },

    fetchEntities: async () => {
      const contextProjectId = get().projectId;
      if (!contextProjectId) {
        set(resetProjectState());
        return;
      }

      set({ loadingEntities: true, error: null });
      try {
        const response = await fetch(
          `/api/timeline/entities?projectId=${encodeURIComponent(contextProjectId)}`,
          { method: "GET" },
        );
        const data = await readApi<unknown>(response);

        if (get().projectId !== contextProjectId) {
          return;
        }

        const entities = normalizeEntityList(data);
        const currentSelectedId = get().selectedEntityId;
        const selectedEntityId =
          currentSelectedId && entities.some((entity) => entity.id === currentSelectedId)
            ? currentSelectedId
            : (entities[0]?.id ?? null);

        set({
          entities,
          selectedEntityId,
          selectedEntity:
            selectedEntityId && selectedEntityId === currentSelectedId
              ? get().selectedEntity
              : null,
          loadingEntities: false,
        });

        if (!selectedEntityId) {
          set({ selectedEntity: null });
          return;
        }

        await fetchEntityDetail(selectedEntityId);
      } catch (error) {
        if (get().projectId !== contextProjectId) {
          return;
        }

        set({
          loadingEntities: false,
          error: normalizeError(error, "实体列表加载失败"),
        });
      }
    },

    selectEntity: async (entityId) => {
      await fetchEntityDetail(entityId);
    },

    extractTimeline: async (chapterId) => {
      const projectId = get().projectId;
      if (!projectId) {
        set({ error: "请先选择项目" });
        return;
      }

      set({ extracting: true, error: null, notice: null });
      try {
        const response = await fetch("/api/timeline/extract", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId,
            chapterId: chapterId ?? undefined,
          }),
        });
        await readApi<unknown>(response);
        await refreshAfterMutation("时间线已刷新");
      } catch (error) {
        set({
          error: normalizeError(error, "时间线抽取失败"),
        });
      } finally {
        set({ extracting: false });
      }
    },

    confirmEvent: async (eventId) => {
      await patchEvent(
        eventId,
        {
          action: "confirm",
          status: "confirmed",
        },
        "事件已确认",
        "事件确认失败",
      );
    },

    rejectEvent: async (eventId) => {
      await patchEvent(
        eventId,
        {
          action: "reject",
          status: "rejected",
        },
        "事件已拒绝",
        "事件拒绝失败",
      );
    },

    editEvent: async (eventId, input) => {
      await patchEvent(
        eventId,
        {
          action: "edit",
          patch: input,
          ...input,
        },
        "事件已更新",
        "事件更新失败",
      );
    },

    clearError: () => {
      set({ error: null });
    },

    clearNotice: () => {
      set({ notice: null });
    },
  };
});
