import { internalError, fail, ok } from "@/lib/http/api-response";
import {
  normalizeTimelineAliases,
  normalizeTimelineEntity,
  validateTimelineEntitiesQuery,
} from "@/lib/http/timeline-validators";
import { TimelineRepository } from "@/repositories/timeline-repository";

type EntityWithAliases = {
  entity: unknown;
  aliases: unknown;
};

const timelineRepository = new TimelineRepository() as unknown as {
  listEntitiesByProject(projectId: string): EntityWithAliases[];
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const validation = validateTimelineEntitiesQuery(url.searchParams);
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    const entities = timelineRepository
      .listEntitiesByProject(validation.data.projectId)
      .map((row) => {
        const entity = normalizeTimelineEntity(row.entity);
        if (!entity) {
          return null;
        }
        return {
          ...entity,
          projectId: entity.projectId ?? validation.data.projectId,
          aliases: normalizeTimelineAliases(row.aliases),
        };
      })
      .filter((entity): entity is NonNullable<typeof entity> => entity !== null);

    return ok({
      entities,
    });
  } catch (error) {
    return internalError(error);
  }
}
