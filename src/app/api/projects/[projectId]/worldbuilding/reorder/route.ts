import { internalError, ok, fail, parseJsonBody } from "@/lib/http/api-response";
import { ProjectsRepository } from "@/repositories/projects-repository";
import { WorldbuildingRepository } from "@/repositories/worldbuilding-repository";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

const projectsRepository = new ProjectsRepository();
const worldbuildingRepository = new WorldbuildingRepository();

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    if (!projectId) {
      return fail("INVALID_PARAM", "projectId is required", 400);
    }

    const project = projectsRepository.findById(projectId);
    if (!project) {
      return fail("NOT_FOUND", "Project not found", 404);
    }

    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const body = bodyResult.data as Record<string, unknown>;

    const parentId =
      body.parentId === null || body.parentId === undefined
        ? null
        : typeof body.parentId === "string" && body.parentId.trim().length > 0
          ? body.parentId.trim()
          : null;

    if (!Array.isArray(body.orderedIds) || body.orderedIds.length === 0) {
      return fail("INVALID_INPUT", "orderedIds must be a non-empty array of strings", 400);
    }

    const orderedIds = body.orderedIds.filter(
      (id): id is string => typeof id === "string" && id.trim().length > 0,
    );

    if (orderedIds.length === 0) {
      return fail("INVALID_INPUT", "orderedIds must contain at least one valid id", 400);
    }

    worldbuildingRepository.reorderChildren(projectId, parentId, orderedIds);

    const nodes = worldbuildingRepository.listByProject(projectId);
    return ok({ nodes });
  } catch (error) {
    return internalError(error);
  }
}
