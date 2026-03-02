import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import {
  normalizeTimelineEvent,
  validatePatchTimelineEventInput,
  validateTimelineEventIdParam,
} from "@/lib/http/timeline-validators";
import { ProjectsRepository } from "@/repositories/projects-repository";
import { TimelineRepository } from "@/repositories/timeline-repository";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

type EntityWithAliases = {
  entity: unknown;
  aliases: unknown;
};

type TimelineRepositoryPort = {
  listEntitiesByProject(projectId: string): EntityWithAliases[];
  getTimelineByEntity(projectId: string, entityId: string): unknown[];
  upsertEventWithSnapshot(input: {
    id: string;
    projectId: string;
    chapterId: string;
    chapterOrder: number;
    sequenceNo?: number;
    title: string;
    summary?: string | null;
    evidence?: string | null;
    confidence?: number;
    status?: "auto" | "confirmed" | "rejected" | "pending_review";
    entityIds: string[];
  }): {
    event: unknown;
    entityIds: string[];
  };
};

type LocatedEvent = {
  projectId: string;
  event: NonNullable<ReturnType<typeof normalizeTimelineEvent>>;
  sequenceNo: number;
  entityIds: string[];
};

const timelineRepository = new TimelineRepository() as unknown as TimelineRepositoryPort;
const projectsRepository = new ProjectsRepository();

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asEntityIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function resolveCandidateProjects(projectIdHint?: string): string[] {
  if (projectIdHint) {
    return [projectIdHint];
  }
  return projectsRepository.list().map((project) => project.id);
}

function locateEventById(eventId: string, projectIdHint?: string): LocatedEvent | null {
  const candidateProjects = resolveCandidateProjects(projectIdHint);

  for (const projectId of candidateProjects) {
    const entities = timelineRepository.listEntitiesByProject(projectId);
    const visitedEventIds = new Set<string>();

    for (const row of entities) {
      const entityRecord = asRecord(row.entity);
      const entityId =
        typeof entityRecord?.id === "string" && entityRecord.id.trim().length > 0
          ? entityRecord.id.trim()
          : undefined;
      if (!entityId) {
        continue;
      }

      const timelineRows = timelineRepository.getTimelineByEntity(projectId, entityId);
      for (const timelineRow of timelineRows) {
        const rowRecord = asRecord(timelineRow) ?? {};
        const normalized = normalizeTimelineEvent({
          ...rowRecord,
          entityId,
        });
        if (!normalized || visitedEventIds.has(normalized.eventId)) {
          continue;
        }
        visitedEventIds.add(normalized.eventId);
        if (normalized.eventId !== eventId) {
          continue;
        }

        const rawEvent = asRecord(rowRecord.event) ?? {};
        const sequenceNo =
          typeof rawEvent.sequenceNo === "number" && Number.isInteger(rawEvent.sequenceNo)
            ? rawEvent.sequenceNo
            : typeof rawEvent.sequence_no === "number" && Number.isInteger(rawEvent.sequence_no)
              ? rawEvent.sequence_no
              : 0;

        const entityIds = asEntityIds(rowRecord.entityIds);
        return {
          projectId,
          event: normalized,
          sequenceNo,
          entityIds: entityIds.length > 0 ? entityIds : [entityId],
        };
      }
    }
  }

  return null;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { eventId } = await context.params;
    const eventIdValidation = validateTimelineEventIdParam(eventId);
    if (!eventIdValidation.ok) {
      return fail(
        eventIdValidation.code,
        eventIdValidation.message,
        400,
        eventIdValidation.details,
      );
    }

    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const validation = validatePatchTimelineEventInput(bodyResult.data);
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    const url = new URL(request.url);
    const projectIdQuery = url.searchParams.get("projectId");
    if (projectIdQuery !== null && projectIdQuery.trim().length === 0) {
      return fail("INVALID_QUERY", "projectId cannot be empty", 400);
    }

    const located = locateEventById(eventIdValidation.data, projectIdQuery?.trim());
    if (!located) {
      return fail("NOT_FOUND", "Timeline event not found", 404);
    }

    const editPayload = validation.data.action === "edit" ? validation.data.payload ?? {} : {};
    const status =
      validation.data.action === "confirm"
        ? "confirmed"
        : validation.data.action === "reject"
          ? "rejected"
          : editPayload.status ?? located.event.status;
    const entityIds =
      editPayload.entityId !== undefined
        ? [editPayload.entityId]
        : located.entityIds.length > 0
          ? located.entityIds
          : [located.event.entityId];
    const chapterId = editPayload.chapterId ?? located.event.chapterId;

    if (!chapterId) {
      return fail("INVALID_DATA", "Timeline event chapterId is missing", 500);
    }

    const updated = timelineRepository.upsertEventWithSnapshot({
      id: located.event.eventId,
      projectId: located.projectId,
      chapterId,
      chapterOrder: editPayload.chapterNo ?? located.event.chapterNo,
      sequenceNo: located.sequenceNo,
      title: editPayload.title ?? located.event.title,
      summary: editPayload.description ?? located.event.description,
      evidence:
        editPayload.evidenceSnippet ??
        located.event.evidenceSnippet ??
        editPayload.description ??
        located.event.description,
      confidence: editPayload.confidence ?? located.event.confidence,
      status,
      entityIds,
    });

    const event = normalizeTimelineEvent({
      event: updated.event,
      entityIds: updated.entityIds,
      entityId: entityIds[0],
    });
    if (!event) {
      return fail("INVALID_DATA", "Timeline event payload is invalid", 500);
    }

    return ok({
      success: true,
      event,
    });
  } catch (error) {
    return internalError(error);
  }
}
