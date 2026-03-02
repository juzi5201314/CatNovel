import { internalError, fail, ok } from "@/lib/http/api-response";
import {
  normalizeTimelineAliases,
  normalizeTimelineEntity,
  normalizeTimelineEvent,
  validateTimelineEntityIdParam,
} from "@/lib/http/timeline-validators";
import { ProjectsRepository } from "@/repositories/projects-repository";
import { TimelineRepository } from "@/repositories/timeline-repository";

type RouteContext = {
  params: Promise<{ entityId: string }>;
};

type EntityWithAliases = {
  entity: unknown;
  aliases: unknown;
};

type TimelineRepositoryPort = {
  listEntitiesByProject(projectId: string): EntityWithAliases[];
  getTimelineByEntity(projectId: string, entityId: string): unknown[];
};

const timelineRepository = new TimelineRepository() as unknown as TimelineRepositoryPort;
const projectsRepository = new ProjectsRepository();

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function resolveEntityScope(entityId: string, projectIdHint?: string) {
  if (projectIdHint) {
    const entities = timelineRepository.listEntitiesByProject(projectIdHint);
    const matched = entities.find(
      (row) => normalizeTimelineEntity(row.entity)?.entityId === entityId,
    );
    if (!matched) {
      return null;
    }
    return { projectId: projectIdHint, row: matched };
  }

  const projects = projectsRepository.list();
  for (const project of projects) {
    const entities = timelineRepository.listEntitiesByProject(project.id);
    const matched = entities.find(
      (row) => normalizeTimelineEntity(row.entity)?.entityId === entityId,
    );
    if (matched) {
      return { projectId: project.id, row: matched };
    }
  }

  return null;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { entityId } = await context.params;
    const validation = validateTimelineEntityIdParam(entityId);
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    const url = new URL(request.url);
    const projectIdQuery = url.searchParams.get("projectId");
    if (projectIdQuery !== null && projectIdQuery.trim().length === 0) {
      return fail("INVALID_QUERY", "projectId cannot be empty", 400);
    }

    const scope = resolveEntityScope(validation.data, projectIdQuery?.trim());
    if (!scope) {
      return fail("NOT_FOUND", "Timeline entity not found", 404);
    }

    const entity = normalizeTimelineEntity(scope.row.entity);
    if (!entity) {
      return fail("INVALID_DATA", "Timeline entity payload is invalid", 500);
    }

    const timelineRows = timelineRepository.getTimelineByEntity(scope.projectId, validation.data);
    const timeline = timelineRows
      .map((row) => {
        const rowRecord = asRecord(row) ?? {};
        return normalizeTimelineEvent({
          ...rowRecord,
          entityId: validation.data,
        });
      })
      .filter((event): event is NonNullable<ReturnType<typeof normalizeTimelineEvent>> => !!event);

    return ok({
      entity: {
        ...entity,
        projectId: entity.projectId ?? scope.projectId,
      },
      aliases: normalizeTimelineAliases(scope.row.aliases),
      timeline,
    });
  } catch (error) {
    return internalError(error);
  }
}
