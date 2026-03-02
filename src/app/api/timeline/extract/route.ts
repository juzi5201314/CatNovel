import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import {
  type ChapterConflictReport,
  type ChapterEventDiffReport,
  type RecomputeChapterTimelineResult,
  TimelineExtractionService,
} from "@/core/timeline/extraction-service";
import {
  normalizeTimelineEntity,
  normalizeTimelineEvent,
  normalizeTimelineEvents,
  validateTimelineExtractInput,
} from "@/lib/http/timeline-validators";
import { ChaptersRepository } from "@/repositories/chapters-repository";
import { TimelineRepository } from "@/repositories/timeline-repository";

type TimelineRepositoryPort = {
  listEntitiesByProject(projectId: string): Array<{ entity: unknown; aliases: unknown }>;
  getTimelineByEntity(projectId: string, entityId: string): unknown[];
  listReviewBacklog(input: {
    projectId: string;
    chapterId?: string;
    statuses?: string[];
    limit?: number;
  }): unknown[];
  countReviewBacklog(projectId: string, chapterId?: string): number;
};

const extractionService = new TimelineExtractionService();
const chaptersRepository = new ChaptersRepository();
const timelineRepository = new TimelineRepository() as unknown as TimelineRepositoryPort;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function collectChapterEvents(projectId: string, chapterId?: string) {
  const eventsById = new Map<
    string,
    NonNullable<ReturnType<typeof normalizeTimelineEvent>>
  >();
  const entityRows = timelineRepository.listEntitiesByProject(projectId);

  for (const entityRow of entityRows) {
    const entity = normalizeTimelineEntity(entityRow.entity);
    if (!entity) {
      continue;
    }

    const timelineRows = timelineRepository.getTimelineByEntity(projectId, entity.entityId);
    for (const timelineRow of timelineRows) {
      const rowRecord = asRecord(timelineRow) ?? {};
      const normalized = normalizeTimelineEvent({
        ...rowRecord,
        entityId: entity.entityId,
      });
      if (!normalized) {
        continue;
      }
      if (chapterId && normalized.chapterId !== chapterId) {
        continue;
      }

      const existing = eventsById.get(normalized.eventId);
      if (!existing || normalized.confidence > existing.confidence) {
        eventsById.set(normalized.eventId, normalized);
      }
    }
  }

  return normalizeTimelineEvents([...eventsById.values()]).sort((left, right) => {
    if (left.chapterNo !== right.chapterNo) {
      return left.chapterNo - right.chapterNo;
    }
    return left.eventId.localeCompare(right.eventId);
  });
}

function normalizeLimit(raw: string | null, fallback: number, max: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(1, Math.trunc(parsed)));
}

function aggregateDiffReport(
  reports: Array<Pick<RecomputeChapterTimelineResult, "diffReport">>,
): ChapterEventDiffReport {
  const merged: ChapterEventDiffReport = {
    added: 0,
    updated: 0,
    removed: 0,
    impacted: 0,
    items: [],
  };
  for (const report of reports) {
    merged.added += report.diffReport.added;
    merged.updated += report.diffReport.updated;
    merged.removed += report.diffReport.removed;
    merged.impacted += report.diffReport.impacted;
    merged.items.push(...report.diffReport.items);
  }
  return merged;
}

function aggregateConflictReport(
  reports: Array<Pick<RecomputeChapterTimelineResult, "conflictReport">>,
): ChapterConflictReport {
  const merged: ChapterConflictReport = {
    hasConflicts: false,
    total: 0,
    byCode: {
      time_order_conflict: 0,
      duplicate_event: 0,
      entity_conflict: 0,
    },
    items: [],
  };

  for (const report of reports) {
    merged.hasConflicts ||= report.conflictReport.hasConflicts;
    merged.total += report.conflictReport.total;
    merged.byCode.time_order_conflict += report.conflictReport.byCode.time_order_conflict;
    merged.byCode.duplicate_event += report.conflictReport.byCode.duplicate_event;
    merged.byCode.entity_conflict += report.conflictReport.byCode.entity_conflict;
    merged.items.push(...report.conflictReport.items);
  }
  return merged;
}

function listReviewBacklog(projectId: string, chapterId?: string, limit = 50): unknown[] {
  const record = asRecord(timelineRepository);
  if (!record || typeof record.listReviewBacklog !== "function") {
    return [];
  }
  return timelineRepository.listReviewBacklog({
    projectId,
    chapterId,
    statuses: ["queued"],
    limit,
  });
}

function countReviewBacklog(projectId: string, chapterId?: string): number {
  const record = asRecord(timelineRepository);
  if (!record || typeof record.countReviewBacklog !== "function") {
    return 0;
  }
  return timelineRepository.countReviewBacklog(projectId, chapterId);
}

export async function POST(request: Request) {
  try {
    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const validation = validateTimelineExtractInput(bodyResult.data);
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    let extractedEvents = 0;
    let lowConfidenceEvents = 0;
    const chapterReports: RecomputeChapterTimelineResult[] = [];

    if (validation.data.chapterId) {
      const result = await extractionService.recomputeChapterEvents({
        projectId: validation.data.projectId,
        chapterId: validation.data.chapterId,
        force: validation.data.force,
      });
      extractedEvents += result.extractedEvents;
      lowConfidenceEvents += result.lowConfidenceEvents;
      chapterReports.push(result);
    } else {
      const chapters = chaptersRepository.listByProject(validation.data.projectId);
      for (const chapter of chapters) {
        const result = await extractionService.recomputeChapterEvents({
          projectId: validation.data.projectId,
          chapterId: chapter.id,
          chapterNo: chapter.orderNo,
          chapterTitle: chapter.title,
          chapterContent: chapter.content ?? "",
          chapterSummary: chapter.summary ?? null,
          force: validation.data.force,
        });
        extractedEvents += result.extractedEvents;
        lowConfidenceEvents += result.lowConfidenceEvents;
        chapterReports.push(result);
      }
    }

    const events = collectChapterEvents(validation.data.projectId, validation.data.chapterId);
    const diffReport = aggregateDiffReport(chapterReports);
    const conflictReport = aggregateConflictReport(chapterReports);
    const queueBacklog = countReviewBacklog(validation.data.projectId, validation.data.chapterId);
    const backlog = listReviewBacklog(validation.data.projectId, validation.data.chapterId, 50);

    return ok({
      extractedEvents,
      lowConfidenceEvents,
      queueBacklog,
      diffReport,
      conflictReport,
      chapterReports,
      backlog,
      events,
    });
  } catch (error) {
    return internalError(error);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    const chapterId = url.searchParams.get("chapterId");
    const limit = normalizeLimit(url.searchParams.get("limit"), 100, 500);

    if (!projectId || projectId.trim().length === 0) {
      return fail("INVALID_QUERY", "projectId is required", 400);
    }
    if (chapterId !== null && chapterId.trim().length === 0) {
      return fail("INVALID_QUERY", "chapterId cannot be empty", 400);
    }

    const normalizedProjectId = projectId.trim();
    const normalizedChapterId = chapterId?.trim();
    const backlog = listReviewBacklog(normalizedProjectId, normalizedChapterId, limit);
    const total = countReviewBacklog(normalizedProjectId, normalizedChapterId);

    return ok({
      projectId: normalizedProjectId,
      chapterId: normalizedChapterId ?? null,
      total,
      backlog,
    });
  } catch (error) {
    return internalError(error);
  }
}
