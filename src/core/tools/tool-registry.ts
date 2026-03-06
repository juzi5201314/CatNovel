import { and, asc, eq } from "drizzle-orm";

import { RetrievalIndexer } from "@/core/retrieval/indexer";
import {
  createQueuedJob,
  markJobDone,
  markJobFailed,
  markJobRunning,
  type RagReindexReason,
} from "@/core/retrieval/runtime";
import { ProjectSnapshotsService } from "@/core/snapshots/snapshot-service";
import { recomputeChapterTimelineEvents } from "@/core/timeline/extraction-service";
import { listToolCatalog } from "@/core/tools/tool-catalog";
import { getDatabase, runInTransaction } from "@/db/client";
import {
  chapters,
  eventEntities,
  events,
  projectSnapshots,
} from "@/db/schema";
import { ChaptersRepository } from "@/repositories/chapters-repository";
import { ProjectsRepository } from "@/repositories/projects-repository";
import { TimelineRepository } from "@/repositories/timeline-repository";
import { ToolApprovalsRepository } from "@/repositories/tool-approvals-repository";
import { WorldbuildingRepository } from "@/repositories/worldbuilding-repository";

export type ToolExecutionInput = {
  projectId: string;
  toolName: string;
  args: unknown;
};

type ToolHandler = (input: ToolExecutionInput) => Promise<unknown>;

type TimelineRepositoryStatus = "auto" | "confirmed" | "rejected" | "pending_review";
type TimelineResolveDecision = "confirm" | "reject" | "queue" | "auto";

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
  reviewReason?: string | null;
  reviewSource?: string | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  statusUpdatedBy?: string | null;
};

type TimelineEditInput = Partial<Omit<TimelineUpsertInput, "projectId" | "id">> & {
  eventId?: string;
  chapterNo?: number;
  chapterOrder?: number;
  description?: string;
  evidenceSnippet?: string;
  entityId?: string;
};

type ChapterScope = {
  from?: number;
  to?: number;
};

const db = getDatabase();
const projectsRepository = new ProjectsRepository();
const chaptersRepository = new ChaptersRepository();
const timelineRepository = new TimelineRepository();
const snapshotsService = new ProjectSnapshotsService();
const approvalsRepository = new ToolApprovalsRepository();
const worldbuildingRepository = new WorldbuildingRepository();
const retrievalIndexer = new RetrievalIndexer();

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

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function asOptionalInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
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

function asTimelineResolveDecision(value: unknown): TimelineResolveDecision | undefined {
  if (value === "confirm" || value === "reject" || value === "queue" || value === "auto") {
    return value;
  }
  return undefined;
}

function clampLimit(input: number | undefined, fallback: number, max: number): number {
  if (!Number.isInteger(input)) {
    return fallback;
  }
  return Math.min(max, Math.max(1, input as number));
}

function parseChapterScope(value: unknown): ChapterScope | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const from = asOptionalInteger(record.from);
  const to = asOptionalInteger(record.to);
  if (from !== undefined && to !== undefined && from > to) {
    return undefined;
  }

  const scope: ChapterScope = {};
  if (from !== undefined) {
    scope.from = from;
  }
  if (to !== undefined) {
    scope.to = to;
  }
  if (scope.from === undefined && scope.to === undefined) {
    return undefined;
  }
  return scope;
}

function chapterInScope(
  orderNo: number,
  scope: ChapterScope | undefined,
): boolean {
  if (!scope) {
    return true;
  }
  if (scope.from !== undefined && orderNo < scope.from) {
    return false;
  }
  if (scope.to !== undefined && orderNo > scope.to) {
    return false;
  }
  return true;
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

function buildSnippet(source: string, query: string, radius = 72): string {
  if (!source) {
    return "";
  }

  const normalizedSource = source.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const index = normalizedSource.indexOf(normalizedQuery);
  if (index < 0) {
    return source.slice(0, Math.min(source.length, 220));
  }

  const from = Math.max(0, index - radius);
  const to = Math.min(source.length, index + query.length + radius);
  return source.slice(from, to);
}

function mapChapterRow(
  row: {
    id: string;
    projectId: string;
    orderNo: number;
    title: string;
    content?: string;
    summary?: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  options?: {
    includeContent?: boolean;
    includeSummary?: boolean;
  },
) {
  const includeContent = options?.includeContent ?? false;
  const includeSummary = options?.includeSummary ?? true;

  return {
    id: row.id,
    projectId: row.projectId,
    orderNo: row.orderNo,
    title: row.title,
    summary: includeSummary ? row.summary ?? null : undefined,
    content: includeContent ? row.content ?? "" : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function summarizeApprovalPayload(rawPayload: string): string {
  try {
    const parsed = JSON.parse(rawPayload) as Record<string, unknown>;
    const toolName = asOptionalNonEmptyString(parsed.toolName);
    if (toolName) {
      return `Request to execute ${toolName}`;
    }
  } catch {
    return "Tool approval request";
  }
  return "Tool approval request";
}

function readApprovalPayload(rawPayload: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(rawPayload) as unknown;
    return asRecord(parsed);
  } catch {
    return null;
  }
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

function maybeResolveProjectId(baseProjectId: string, record: Record<string, unknown>): string {
  return asOptionalNonEmptyString(record.projectId) ?? baseProjectId;
}

function resolveChapterSearchHits(input: {
  projectId: string;
  query: string;
  topK: number;
  chapterScope?: ChapterScope;
}) {
  const chaptersList = chaptersRepository.listByProject(input.projectId);
  const query = input.query.trim();
  const normalizedQuery = query.toLowerCase();

  const hits = chaptersList
    .filter((chapter) => chapterInScope(chapter.orderNo, input.chapterScope))
    .map((chapter) => {
      const title = chapter.title ?? "";
      const content = chapter.content ?? "";
      const summary = chapter.summary ?? "";
      const normalizedTitle = title.toLowerCase();
      const normalizedContent = content.toLowerCase();
      const normalizedSummary = summary.toLowerCase();

      const titleMatched = normalizedTitle.includes(normalizedQuery);
      const summaryMatched = normalizedSummary.includes(normalizedQuery);
      const contentMatched = normalizedContent.includes(normalizedQuery);
      if (!titleMatched && !summaryMatched && !contentMatched) {
        return null;
      }

      const score =
        (titleMatched ? 1.0 : 0) +
        (summaryMatched ? 0.65 : 0) +
        (contentMatched ? 0.45 : 0);

      const snippetSource = summaryMatched ? summary : contentMatched ? content : title;
      return {
        chapterId: chapter.id,
        chapterNo: chapter.orderNo,
        title: chapter.title,
        score,
        snippet: buildSnippet(snippetSource, query),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.chapterNo - right.chapterNo;
    })
    .slice(0, input.topK);

  return hits;
}

async function safeRecomputeChapterTimeline(chapter: {
  projectId: string;
  id: string;
  orderNo: number;
  title: string;
  content?: string;
  summary?: string | null;
}) {
  try {
    const timelineRecompute = await recomputeChapterTimelineEvents({
      projectId: chapter.projectId,
      chapterId: chapter.id,
      chapterNo: chapter.orderNo,
      chapterTitle: chapter.title,
      chapterContent: chapter.content ?? "",
      chapterSummary: chapter.summary ?? null,
    });

    return {
      timelineRecompute: {
        lowConfidenceEvents: timelineRecompute.lowConfidenceEvents,
        diffReport: timelineRecompute.diffReport,
        conflictReport: timelineRecompute.conflictReport,
      },
      timelineRecomputeError: null,
    };
  } catch (error) {
    return {
      timelineRecompute: null,
      timelineRecomputeError:
        error instanceof Error ? error.message : "timeline recompute failed",
    };
  }
}

async function enqueueReindex(input: {
  projectId: string;
  chapterIds?: string[];
  reason: RagReindexReason;
}) {
  const job = createQueuedJob({
    projectId: input.projectId,
    reason: input.reason,
    chapterCount: input.chapterIds?.length ?? 0,
  });

  void (async () => {
    markJobRunning(job.jobId);
    try {
      const summary = await retrievalIndexer.reindex({
        projectId: input.projectId,
        chapterIds: input.chapterIds,
      });
      markJobDone(job.jobId, summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "reindex failed";
      markJobFailed(job.jobId, message);
    }
  })();

  return job;
}

const handlers: Record<string, ToolHandler> = {
  "system.listTools": async () => {
    const toolNames = Object.keys(handlers).sort((left, right) => left.localeCompare(right));
    const catalogByName = new Map(
      listToolCatalog().map((item) => [item.toolName, item] as const),
    );
    return {
      tools: toolNames.map((toolName) => {
        const catalogItem = catalogByName.get(toolName);
        return {
          toolName,
          riskLevel: catalogItem?.riskLevel ?? "high_risk",
          description: catalogItem?.description ?? "No description",
        };
      }),
      count: toolNames.length,
    };
  },
  "chapter.list": async ({ projectId, args }) => {
    const record = asRecord(args) ?? {};
    const resolvedProjectId = maybeResolveProjectId(projectId, record);
    const includeSummary = asOptionalBoolean(record.includeSummary) ?? true;
    const includeContent = asOptionalBoolean(record.includeContent) ?? false;

    const rows = chaptersRepository.listByProject(resolvedProjectId);
    return {
      chapters: rows.map((row) =>
        mapChapterRow(row, { includeSummary, includeContent }),
      ),
      count: rows.length,
    };
  },
  "chapter.get": async ({ projectId, args }) => {
    const record = asRecord(args);
    const chapterId = asOptionalNonEmptyString(record?.chapterId);
    if (!chapterId) {
      throw new Error("chapterId is required");
    }

    const chapter =
      chaptersRepository.findById(projectId, chapterId) ??
      chaptersRepository.findByChapterId(chapterId);
    if (!chapter || chapter.projectId !== projectId) {
      return { chapter: null };
    }

    return {
      chapter: mapChapterRow(chapter, { includeSummary: true, includeContent: false }),
    };
  },
  "chapter.getContent": async ({ projectId, args }) => {
    const record = asRecord(args);
    const chapterId = asOptionalNonEmptyString(record?.chapterId);
    if (!chapterId) {
      throw new Error("chapterId is required");
    }

    const chapter =
      chaptersRepository.findById(projectId, chapterId) ??
      chaptersRepository.findByChapterId(chapterId);
    if (!chapter || chapter.projectId !== projectId) {
      return { chapter: null };
    }

    return {
      chapter: mapChapterRow(chapter, { includeSummary: true, includeContent: true }),
    };
  },
  "chapter.search": async ({ projectId, args }) => {
    const record = asRecord(args);
    const query = asOptionalNonEmptyString(record?.query);
    if (!query) {
      throw new Error("query is required");
    }

    const topK = clampLimit(asOptionalInteger(record?.topK), 8, 50);
    const chapterScope = parseChapterScope(record?.chapterScope);
    const hits = resolveChapterSearchHits({
      projectId,
      query,
      topK,
      chapterScope,
    });

    return {
      query,
      hits,
    };
  },
  "chapter.range": async ({ projectId, args }) => {
    const record = asRecord(args) ?? {};
    const includeContent = asOptionalBoolean(record.includeContent) ?? true;
    const includeSummary = asOptionalBoolean(record.includeSummary) ?? true;
    const chapterNos = asStringArray(record.chapterNos)
      .map((item) => Number.parseInt(item, 10))
      .filter((item) => Number.isInteger(item));
    const from = asOptionalInteger(record.from);
    const to = asOptionalInteger(record.to);

    const rows = chaptersRepository
      .listByProject(projectId)
      .filter((row) => {
        if (chapterNos.length > 0) {
          return chapterNos.includes(row.orderNo);
        }
        if (from !== undefined && row.orderNo < from) {
          return false;
        }
        if (to !== undefined && row.orderNo > to) {
          return false;
        }
        return true;
      });

    return {
      chapters: rows.map((row) => mapChapterRow(row, { includeContent, includeSummary })),
      count: rows.length,
    };
  },
  "chapter.create": async ({ projectId, args }) => {
    const record = asRecord(args);
    const title = asOptionalNonEmptyString(record?.title);
    if (!title) {
      throw new Error("title is required");
    }

    if (!projectsRepository.findById(projectId)) {
      throw new Error("project not found");
    }

    const orderNo =
      asOptionalInteger(record?.orderNo) ??
      asOptionalInteger(record?.order) ??
      chaptersRepository.getNextOrderNo(projectId);

    const chapter = chaptersRepository.create({
      id: asOptionalNonEmptyString(record?.id) ?? crypto.randomUUID(),
      projectId,
      orderNo,
      title,
      content: asOptionalString(record?.content) ?? "",
      summary: asNullableString(record?.summary) ?? null,
    });

    return {
      created: true,
      chapter: mapChapterRow(chapter, { includeSummary: true, includeContent: true }),
    };
  },
  "chapter.updateMeta": async ({ projectId, args }) => {
    const record = asRecord(args);
    const chapterId = asOptionalNonEmptyString(record?.chapterId);
    if (!chapterId) {
      throw new Error("chapterId is required");
    }

    const nextTitle = asOptionalNonEmptyString(record?.title);
    const nextSummary = asNullableString(record?.summary);
    const nextOrderNo = asOptionalInteger(record?.orderNo) ?? asOptionalInteger(record?.order);

    if (nextTitle === undefined && nextSummary === undefined && nextOrderNo === undefined) {
      throw new Error("at least one of title/summary/orderNo is required");
    }

    const updated = runInTransaction((tx) => {
      const existing = tx
        .select()
        .from(chapters)
        .where(and(eq(chapters.projectId, projectId), eq(chapters.id, chapterId)))
        .get();
      if (!existing) {
        return null;
      }

      tx.update(chapters)
        .set({
          title: nextTitle ?? existing.title,
          summary: nextSummary === undefined ? existing.summary : nextSummary,
          orderNo: nextOrderNo ?? existing.orderNo,
          updatedAt: new Date(),
        })
        .where(eq(chapters.id, chapterId))
        .run();

      return (
        tx
          .select()
          .from(chapters)
          .where(eq(chapters.id, chapterId))
          .get() ?? null
      );
    });

    if (!updated) {
      return {
        updated: false,
        chapter: null,
      };
    }

    const timelineResult =
      nextSummary !== undefined
        ? await safeRecomputeChapterTimeline(updated)
        : { timelineRecompute: null, timelineRecomputeError: null };

    return {
      updated: true,
      chapter: mapChapterRow(updated, { includeSummary: true, includeContent: true }),
      ...timelineResult,
    };
  },
  "chapter.updateContent": async ({ projectId, args }) => {
    const record = asRecord(args);
    const chapterId = asOptionalNonEmptyString(record?.chapterId);
    if (!chapterId) {
      throw new Error("chapterId is required");
    }

    const existing = chaptersRepository.findById(projectId, chapterId);
    if (!existing) {
      return {
        updated: false,
        chapter: null,
      };
    }

    const content = asOptionalString(record?.content);
    if (content === undefined) {
      throw new Error("content is required");
    }

    const mode = asOptionalNonEmptyString(record?.mode) ?? "replace";
    const resolvedContent =
      mode === "append"
        ? `${existing.content ?? ""}${content}`
        : mode === "prepend"
          ? `${content}${existing.content ?? ""}`
          : content;
    const summary = asNullableString(record?.summary);

    const saveResult = snapshotsService.saveChapterWithAutoSnapshot(chapterId, {
      content: resolvedContent,
      summary: summary === undefined ? undefined : summary,
    });

    if (!saveResult.chapter || saveResult.chapter.projectId !== projectId) {
      return {
        updated: false,
        chapter: null,
      };
    }

    const timelineResult = await safeRecomputeChapterTimeline(saveResult.chapter);
    return {
      updated: true,
      chapter: mapChapterRow(saveResult.chapter, { includeSummary: true, includeContent: true }),
      autoSnapshot: saveResult.autoSnapshot,
      ...timelineResult,
    };
  },
  "chapter.reorder": async ({ projectId, args }) => {
    const record = asRecord(args) ?? {};
    const orderedChapterIds = asStringArray(record.orderedChapterIds);
    const itemRecords = Array.isArray(record.items)
      ? record.items.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => item !== null)
      : [];

    const updatedRows = runInTransaction((tx) => {
      const existingRows = tx
        .select()
        .from(chapters)
        .where(eq(chapters.projectId, projectId))
        .orderBy(asc(chapters.orderNo))
        .all();
      if (existingRows.length === 0) {
        return [];
      }

      if (orderedChapterIds.length > 0) {
        const existingIds = new Set(existingRows.map((row) => row.id));
        const inputIds = new Set(orderedChapterIds);
        if (inputIds.size !== existingIds.size || orderedChapterIds.length !== existingRows.length) {
          throw new Error("orderedChapterIds must contain all project chapter ids exactly once");
        }
        for (const chapterId of orderedChapterIds) {
          if (!existingIds.has(chapterId)) {
            throw new Error(`chapter id not found in project: ${chapterId}`);
          }
        }

        for (let index = 0; index < orderedChapterIds.length; index += 1) {
          tx.update(chapters)
            .set({ orderNo: index + 1, updatedAt: new Date() })
            .where(and(eq(chapters.projectId, projectId), eq(chapters.id, orderedChapterIds[index] as string)))
            .run();
        }
      } else if (itemRecords.length > 0) {
        const orderSet = new Set<number>();
        for (const itemRecord of itemRecords) {
          const chapterId = asOptionalNonEmptyString(itemRecord.chapterId);
          const orderNo = asOptionalInteger(itemRecord.orderNo);
          if (!chapterId || orderNo === undefined || orderNo < 1) {
            throw new Error("items must contain chapterId and positive orderNo");
          }
          if (orderSet.has(orderNo)) {
            throw new Error("items.orderNo must be unique");
          }
          orderSet.add(orderNo);
          tx.update(chapters)
            .set({ orderNo, updatedAt: new Date() })
            .where(and(eq(chapters.projectId, projectId), eq(chapters.id, chapterId)))
            .run();
        }
      } else {
        throw new Error("orderedChapterIds or items is required");
      }

      return tx
        .select()
        .from(chapters)
        .where(eq(chapters.projectId, projectId))
        .orderBy(asc(chapters.orderNo))
        .all();
    });

    return {
      reordered: true,
      chapters: updatedRows.map((row) =>
        mapChapterRow(row, { includeSummary: true, includeContent: false }),
      ),
    };
  },
  "chapter.delete": async ({ projectId, args }) => {
    const record = asRecord(args);
    const chapterId = asOptionalNonEmptyString(record?.chapterId);
    if (!chapterId) {
      throw new Error("chapterId is required");
    }

    const result = runInTransaction((tx) => {
      const existing = tx
        .select()
        .from(chapters)
        .where(and(eq(chapters.projectId, projectId), eq(chapters.id, chapterId)))
        .get();
      if (!existing) {
        return {
          deleted: false,
          deletedTimelineEventCount: 0,
          chapter: null,
        };
      }

      const timelineEventCount = tx
        .select({ id: events.id })
        .from(events)
        .where(and(eq(events.projectId, projectId), eq(events.chapterId, chapterId)))
        .all().length;

      tx.delete(chapters)
        .where(and(eq(chapters.projectId, projectId), eq(chapters.id, chapterId)))
        .run();

      return {
        deleted: true,
        deletedTimelineEventCount: timelineEventCount,
        chapter: existing,
      };
    });

    return result;
  },
  "project.getOverview": async ({ projectId, args }) => {
    const record = asRecord(args) ?? {};
    const resolvedProjectId = maybeResolveProjectId(projectId, record);
    const project = projectsRepository.findById(resolvedProjectId);
    if (!project) {
      return { project: null };
    }

    const chapterRows = chaptersRepository.listByProject(resolvedProjectId);
    const eventRows = db
      .select({
        id: events.id,
        status: events.status,
        confidence: events.confidence,
      })
      .from(events)
      .where(eq(events.projectId, resolvedProjectId))
      .all();

    const statusBreakdown: Record<TimelineRepositoryStatus, number> = {
      auto: 0,
      confirmed: 0,
      rejected: 0,
      pending_review: 0,
    };
    for (const row of eventRows) {
      statusBreakdown[row.status as TimelineRepositoryStatus] += 1;
    }

    const snapshotCount = db
      .select({ id: projectSnapshots.id })
      .from(projectSnapshots)
      .where(eq(projectSnapshots.projectId, resolvedProjectId))
      .all().length;

    const pendingApprovalCount = approvalsRepository.listByProject(resolvedProjectId, "pending").length;
    const pendingReviewCount = timelineRepository.countReviewBacklog(resolvedProjectId);
    const totalCharacters = chapterRows.reduce(
      (sum, chapter) => sum + (chapter.content?.length ?? 0),
      0,
    );
    const latestChapterUpdatedAt =
      chapterRows.length > 0
        ? chapterRows.reduce((latest, chapter) =>
            latest.getTime() > chapter.updatedAt.getTime() ? latest : chapter.updatedAt,
          chapterRows[0]!.updatedAt)
        : null;

    return {
      project: {
        id: project.id,
        name: project.name,
        mode: project.mode,
        systemPrompt: project.systemPrompt,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
      chapters: {
        count: chapterRows.length,
        totalCharacters,
        latestChapterNo: chapterRows.at(-1)?.orderNo ?? null,
        latestUpdatedAt: latestChapterUpdatedAt?.toISOString() ?? null,
      },
      timeline: {
        eventCount: eventRows.length,
        pendingReviewCount,
        statusBreakdown,
      },
      snapshots: {
        count: snapshotCount,
      },
      approvals: {
        pendingCount: pendingApprovalCount,
      },
    };
  },
  "timeline.getEntity": async ({ projectId, args }) => {
    const record = asRecord(args);
    const entityId = asOptionalNonEmptyString(record?.entityId);
    const nameOrAlias = asOptionalNonEmptyString(record?.nameOrAlias);

    let resolvedEntityId = entityId;
    if (!resolvedEntityId && nameOrAlias) {
      resolvedEntityId =
        timelineRepository.findEntityByNameOrAlias(projectId, nameOrAlias)?.id ?? undefined;
    }
    if (!resolvedEntityId) {
      throw new Error("entityId or nameOrAlias is required");
    }

    const entitiesRows = timelineRepository.listEntitiesByProject(projectId);
    const entityRow = entitiesRows.find((row) => extractEntityId(row) === resolvedEntityId);
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
      timeline: timelineRepository.getTimelineByEntity(projectId, resolvedEntityId),
    };
  },
  "timeline.listEvents": async ({ projectId, args }) => {
    const record = asRecord(args) ?? {};
    const resolvedProjectId = maybeResolveProjectId(projectId, record);
    const entityId = asOptionalNonEmptyString(record.entityId);
    const chapterId = asOptionalNonEmptyString(record.chapterId);
    const status = asOptionalNonEmptyString(record.status);
    const limit = clampLimit(asOptionalInteger(record.limit), 50, 300);

    const eventsList = listProjectTimelineEvents(resolvedProjectId, entityId).filter((item) => {
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
      events: eventsList.slice(0, limit),
      count: eventsList.length,
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
      throw new Error("timeline.upsertEvent requires chapterId/chapterOrder/title/entityIds");
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
    } as TimelineUpsertInput);

    return {
      upserted: true,
      event: result.event,
      entityIds: result.entityIds,
      snapshotId: result.snapshotId,
      conflictResult: result.conflictResult,
      reviewBacklog: result.reviewBacklog,
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
    } as TimelineUpsertInput);

    return {
      edited: true,
      event: result.event,
      entityIds: result.entityIds,
      snapshotId: result.snapshotId,
      conflictResult: result.conflictResult,
      reviewBacklog: result.reviewBacklog,
    };
  },
  "timeline.resolveConflict": async ({ projectId, args }) => {
    const record = asRecord(args);
    const eventId = asOptionalNonEmptyString(record?.eventId);
    if (!eventId) {
      throw new Error("eventId is required");
    }

    const decision = asTimelineResolveDecision(record?.decision);
    const statusFromArg = asTimelineStatus(record?.status);
    const nextStatus =
      statusFromArg ??
      (decision === "confirm"
        ? "confirmed"
        : decision === "reject"
          ? "rejected"
          : decision === "queue"
            ? "pending_review"
            : decision === "auto"
              ? "auto"
              : undefined);
    if (!nextStatus) {
      throw new Error("decision or status is required");
    }

    const existingEvent = db
      .select()
      .from(events)
      .where(and(eq(events.projectId, projectId), eq(events.id, eventId)))
      .get();
    if (!existingEvent) {
      return {
        resolved: false,
        event: null,
      };
    }

    const entityRows = db
      .select({ entityId: eventEntities.entityId })
      .from(eventEntities)
      .where(eq(eventEntities.eventId, eventId))
      .all();
    const entityIds = entityRows.map((row) => row.entityId);
    if (entityIds.length === 0) {
      throw new Error("timeline.resolveConflict cannot resolve entityIds");
    }

    const result = timelineRepository.upsertEventWithSnapshot({
      id: existingEvent.id,
      projectId,
      chapterId: existingEvent.chapterId,
      chapterOrder: existingEvent.chapterOrder,
      sequenceNo: existingEvent.sequenceNo,
      title: existingEvent.title,
      summary: existingEvent.summary,
      evidence: existingEvent.evidence,
      confidence: existingEvent.confidence,
      status: nextStatus,
      entityIds,
      reviewReason: asOptionalString(record?.reason) ?? null,
      reviewSource: "manual_conflict_resolution",
      reviewedBy: asOptionalString(record?.reviewedBy) ?? "chat_tool",
      reviewNote: asOptionalString(record?.note) ?? null,
      statusUpdatedBy: asOptionalString(record?.reviewedBy) ?? "chat_tool",
    } as TimelineUpsertInput);

    return {
      resolved: true,
      event: result.event,
      entityIds: result.entityIds,
      snapshotId: result.snapshotId,
      conflictResult: result.conflictResult,
      reviewBacklog: result.reviewBacklog,
    };
  },
  "lore.listNodes": async ({ projectId, args }) => {
    const record = asRecord(args) ?? {};
    const query = asOptionalNonEmptyString(record.query);
    const limit = clampLimit(asOptionalInteger(record.limit), 100, 500);

    let nodes;
    if (query) {
      nodes = worldbuildingRepository.searchByText(projectId, query, limit);
    } else {
      nodes = worldbuildingRepository.listByProject(projectId).slice(0, limit);
    }

    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        name: n.name,
        parentId: n.parentId,
        description: n.description,
        sortOrder: n.sortOrder,
        depth: n.parentId ? "nested" : "root",
      })),
      count: nodes.length,
    };
  },
  "lore.getNode": async ({ projectId, args }) => {
    const record = asRecord(args);
    const nodeId = asOptionalNonEmptyString(record?.nodeId);
    const name = asOptionalNonEmptyString(record?.name);

    let node = nodeId ? worldbuildingRepository.findById(nodeId) : null;

    if (!node && name) {
      const all = worldbuildingRepository.listByProject(projectId);
      node = all.find((n) => n.name.toLowerCase() === name.toLowerCase()) ?? null;
    }

    if (!node || node.projectId !== projectId) {
      return { node: null };
    }

    const children = worldbuildingRepository.getChildren(node.id);
    return {
      node: {
        id: node.id,
        name: node.name,
        parentId: node.parentId,
        description: node.description,
        sortOrder: node.sortOrder,
      },
      children: children.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
      })),
    };
  },
  "lore.upsertNode": async ({ projectId, args }) => {
    const record = asRecord(args);
    if (!record) {
      throw new Error("lore.upsertNode args must be an object");
    }

    const name = asOptionalNonEmptyString(record.name);
    if (!name) {
      throw new Error("name is required");
    }

    const nodeId = asOptionalNonEmptyString(record.nodeId);
    const description = typeof record.description === "string" ? record.description : undefined;
    const parentId = record.parentId === null
      ? null
      : asOptionalNonEmptyString(record.parentId) ?? undefined;

    if (nodeId) {
      const updates: Record<string, unknown> = { name };
      if (description !== undefined) updates.description = description;
      if (parentId !== undefined) updates.parentId = parentId;

      const updated = worldbuildingRepository.update(nodeId, updates as { name?: string; description?: string; parentId?: string | null });
      if (!updated) {
        throw new Error("node not found");
      }
      return { upserted: true, node: updated };
    }

    const created = worldbuildingRepository.create({
      id: crypto.randomUUID(),
      projectId,
      parentId: parentId ?? null,
      name,
      description: description ?? "",
    });

    return { upserted: true, node: created };
  },
  "lore.deleteNode": async ({ projectId, args }) => {
    const record = asRecord(args);
    const nodeId = asOptionalNonEmptyString(record?.nodeId);
    if (!nodeId) {
      throw new Error("nodeId is required");
    }

    const existing = worldbuildingRepository.findById(nodeId);
    if (!existing || existing.projectId !== projectId) {
      return { deleted: false, nodeId };
    }

    const deleted = worldbuildingRepository.deleteById(nodeId);
    return { deleted, nodeId };
  },
  "lore.searchNodes": async ({ projectId, args }) => {
    const record = asRecord(args);
    const query = asOptionalNonEmptyString(record?.query);
    if (!query) {
      throw new Error("query is required");
    }

    const limit = clampLimit(asOptionalInteger(record?.limit), 20, 100);
    const results = worldbuildingRepository.searchByText(projectId, query, limit);

    return {
      query,
      results: results.map((n) => ({
        id: n.id,
        name: n.name,
        parentId: n.parentId,
        description: n.description.slice(0, 500),
        sortOrder: n.sortOrder,
      })),
      count: results.length,
    };
  },
  "lore.getRootDescriptions": async ({ projectId }) => {
    const roots = worldbuildingRepository.getRootNodes(projectId);
    return {
      nodes: roots.map((n) => ({
        id: n.id,
        name: n.name,
        description: n.description,
      })),
      count: roots.length,
    };
  },
  "rag.search": async ({ projectId, args }) => {
    const record = asRecord(args);
    const query = asOptionalNonEmptyString(record?.query);
    if (!query) {
      throw new Error("query is required");
    }

    const topK = clampLimit(asOptionalInteger(record?.topK), 8, 50);
    const chapterScope = parseChapterScope(record?.chapterScope);
    const hits = resolveChapterSearchHits({
      projectId,
      query,
      topK,
      chapterScope,
    }).map((item) => ({
      chapterNo: item.chapterNo,
      chapterId: item.chapterId,
      chunkId: `${item.chapterId}:search`,
      score: item.score,
      snippet: item.snippet,
    }));

    return {
      query,
      hits,
    };
  },
  "rag.getEvidence": async ({ projectId, args }) => {
    const record = asRecord(args) ?? {};
    const chunkIds = asStringArray(record.chunkIds);
    const chapterIds = asStringArray(record.chapterIds);
    const chapterId = asOptionalNonEmptyString(record.chapterId);
    const maxChars = clampLimit(asOptionalInteger(record.maxChars), 1200, 12000);

    if (chapterId) {
      chapterIds.push(chapterId);
    }
    for (const chunkId of chunkIds) {
      const parsedChapterId = asOptionalNonEmptyString(chunkId.split(":")[0]);
      if (parsedChapterId) {
        chapterIds.push(parsedChapterId);
      }
    }

    const dedupedChapterIds = [...new Set(chapterIds)];
    const evidence = dedupedChapterIds
      .map((id) => chaptersRepository.findByChapterId(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter((row) => row.projectId === projectId)
      .map((row) => ({
        chapterId: row.id,
        chapterNo: row.orderNo,
        title: row.title,
        summary: row.summary ?? null,
        snippet: (row.content ?? "").slice(0, maxChars),
        updatedAt: row.updatedAt.toISOString(),
      }));

    return {
      evidence,
      count: evidence.length,
    };
  },
  "rag.reindex": async ({ projectId, args }) => {
    const record = asRecord(args) ?? {};
    const chapterIds = asStringArray(record.chapterIds);
    const reason = (asOptionalNonEmptyString(record.reason) ?? "full_rebuild") as RagReindexReason;
    if (reason !== "chapter_updated" && reason !== "full_rebuild") {
      throw new Error("reason must be chapter_updated or full_rebuild");
    }

    const job = await enqueueReindex({
      projectId,
      chapterIds: chapterIds.length > 0 ? chapterIds : undefined,
      reason,
    });

    return {
      queued: true,
      jobId: job.jobId,
      status: job.status,
      reason,
      chapterCount: job.chapterCount,
    };
  },
  "snapshot.list": async ({ projectId, args }) => {
    const record = asRecord(args) ?? {};
    const limit = clampLimit(asOptionalInteger(record.limit), 20, 100);
    const rows = snapshotsService.listSnapshots(projectId, limit);
    return {
      snapshots: rows.map((row) => ({
        id: row.id,
        projectId: row.projectId,
        sourceChapterId: row.sourceChapterId,
        sourceSnapshotId: row.sourceSnapshotId,
        triggerType: row.triggerType,
        triggerReason: row.triggerReason,
        chapterCount: row.chapterCount,
        timelineEventCount: row.timelineEventCount,
        timelineSummary: row.timelineSummary,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      count: rows.length,
    };
  },
  "snapshot.create": async ({ projectId, args }) => {
    const record = asRecord(args);
    const reason = asOptionalNonEmptyString(record?.reason);
    const result = snapshotsService.createManualSnapshot(projectId, reason);
    return {
      created: true,
      snapshot: {
        id: result.snapshot.id,
        projectId: result.snapshot.projectId,
        triggerType: result.snapshot.triggerType,
        triggerReason: result.snapshot.triggerReason,
        chapterCount: result.snapshot.chapterCount,
        timelineEventCount: result.snapshot.timelineEventCount,
        timelineSummary: result.snapshot.timelineSummary,
        createdAt: result.snapshot.createdAt.toISOString(),
        updatedAt: result.snapshot.updatedAt.toISOString(),
      },
    };
  },
  "snapshot.restore": async ({ projectId, args }) => {
    const record = asRecord(args);
    const snapshotId = asOptionalNonEmptyString(record?.snapshotId);
    if (!snapshotId) {
      throw new Error("snapshotId is required");
    }

    const reason = asOptionalNonEmptyString(record?.reason);
    const result = snapshotsService.restoreSnapshot(projectId, snapshotId, reason);
    return {
      restored: true,
      result,
    };
  },
  "approval.listPending": async ({ projectId, args }) => {
    const record = asRecord(args) ?? {};
    const limit = clampLimit(asOptionalInteger(record.limit), 50, 500);
    const rows = approvalsRepository.listByProject(projectId, "pending").slice(0, limit);

    return {
      approvals: rows.map((row) => ({
        id: row.id,
        projectId: row.projectId,
        toolName: row.toolName,
        riskLevel: row.riskLevel,
        status: row.status,
        summary: summarizeApprovalPayload(row.requestPayload),
        requestPayload: readApprovalPayload(row.requestPayload),
        requestedAt: row.requestedAt.toISOString(),
        expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      })),
      count: rows.length,
    };
  },
  "approval.approve": async ({ projectId, args }) => {
    const record = asRecord(args);
    const approvalId = asOptionalNonEmptyString(record?.approvalId);
    if (!approvalId) {
      throw new Error("approvalId is required");
    }

    const approval = approvalsRepository.getById(approvalId);
    if (!approval || approval.projectId !== projectId) {
      return {
        approved: false,
        reason: "approval not found",
      };
    }
    if (approval.status !== "pending") {
      return {
        approved: false,
        reason: `approval status must be pending, current=${approval.status}`,
      };
    }

    const changed = approvalsRepository.transition({
      approvalId,
      toStatus: "approved",
      reason: asOptionalString(record?.comment) ?? "Approved from chat tool",
    });

    return {
      approved: changed,
      approvalId,
      requiresExecution: true,
      nextAction: changed
        ? "Call /api/tools/execute with approvalId to execute approved tool."
        : "Approval transition failed.",
    };
  },
  "approval.reject": async ({ projectId, args }) => {
    const record = asRecord(args);
    const approvalId = asOptionalNonEmptyString(record?.approvalId);
    if (!approvalId) {
      throw new Error("approvalId is required");
    }

    const approval = approvalsRepository.getById(approvalId);
    if (!approval || approval.projectId !== projectId) {
      return {
        rejected: false,
        reason: "approval not found",
      };
    }
    if (approval.status !== "pending") {
      return {
        rejected: false,
        reason: `approval status must be pending, current=${approval.status}`,
      };
    }

    const changed = approvalsRepository.transition({
      approvalId,
      toStatus: "rejected",
      reason: asOptionalString(record?.reason) ?? "Rejected from chat tool",
    });

    return {
      rejected: changed,
      approvalId,
    };
  },
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
