import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import {
  normalizeTimelineEntity,
  normalizeTimelineEvent,
  normalizeTimelineEvents,
  validateTimelineExtractInput,
} from "@/lib/http/timeline-validators";
import { TimelineExtractionService } from "@/core/timeline/extraction-service";
import { ChaptersRepository } from "@/repositories/chapters-repository";
import { TimelineRepository } from "@/repositories/timeline-repository";

type TimelineRepositoryPort = {
  listEntitiesByProject(projectId: string): Array<{ entity: unknown; aliases: unknown }>;
  getTimelineByEntity(projectId: string, entityId: string): unknown[];
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

    if (validation.data.chapterId) {
      const result = await extractionService.recomputeChapterEvents({
        projectId: validation.data.projectId,
        chapterId: validation.data.chapterId,
        force: validation.data.force,
      });
      extractedEvents += result.extractedEvents;
      lowConfidenceEvents += result.lowConfidenceEvents;
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
      }
    }

    const events = collectChapterEvents(validation.data.projectId, validation.data.chapterId);

    return ok({
      extractedEvents,
      lowConfidenceEvents,
      events,
    });
  } catch (error) {
    return internalError(error);
  }
}
