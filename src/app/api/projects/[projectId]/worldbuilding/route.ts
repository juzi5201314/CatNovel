import { internalError, ok, fail, parseJsonBody } from "@/lib/http/api-response";
import { ProjectsRepository } from "@/repositories/projects-repository";
import { WorldbuildingRepository } from "@/repositories/worldbuilding-repository";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

const projectsRepository = new ProjectsRepository();
const worldbuildingRepository = new WorldbuildingRepository();

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    if (!projectId) {
      return fail("INVALID_PARAM", "projectId is required", 400);
    }

    const project = projectsRepository.findById(projectId);
    if (!project) {
      return fail("NOT_FOUND", "Project not found", 404);
    }

    const nodes = worldbuildingRepository.listByProject(projectId);
    return ok({ nodes });
  } catch (error) {
    return internalError(error);
  }
}

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
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length === 0) {
      return fail("INVALID_INPUT", "name is required and must be non-empty", 400);
    }

    const parentId =
      typeof body.parentId === "string" && body.parentId.trim().length > 0
        ? body.parentId.trim()
        : null;

    if (parentId) {
      const parent = worldbuildingRepository.findById(parentId);
      if (!parent || parent.projectId !== projectId) {
        return fail("INVALID_INPUT", "parent node not found in this project", 400);
      }
    }

    const description =
      typeof body.description === "string" ? body.description : "";

    const node = worldbuildingRepository.create({
      id: crypto.randomUUID(),
      projectId,
      parentId,
      name,
      description,
    });

    return ok(node, 201);
  } catch (error) {
    return internalError(error);
  }
}
