import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import { validatePatchProjectInput } from "@/lib/http/validators";
import { ProjectsRepository } from "@/repositories/projects-repository";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

const projectsRepository = new ProjectsRepository();

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    if (!projectId) {
      return fail("INVALID_PARAM", "projectId is required", 400);
    }

    const existing = projectsRepository.findById(projectId);
    if (!existing) {
      return fail("NOT_FOUND", "Project not found", 404);
    }

    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const validation = validatePatchProjectInput(bodyResult.data);
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    const updated = projectsRepository.updateName(projectId, validation.data.name);
    if (!updated) {
      return fail("UPDATE_FAILED", "failed to update project", 500);
    }

    const project = projectsRepository.findById(projectId);
    if (!project) {
      return fail("NOT_FOUND", "Project not found", 404);
    }

    return ok(project);
  } catch (error) {
    return internalError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    if (!projectId) {
      return fail("INVALID_PARAM", "projectId is required", 400);
    }

    const existing = projectsRepository.findById(projectId);
    if (!existing) {
      return fail("NOT_FOUND", "Project not found", 404);
    }

    const deleted = projectsRepository.deleteById(projectId);
    if (!deleted) {
      return fail("DELETE_FAILED", "failed to delete project", 500);
    }

    return ok({ success: true, deletedProjectId: projectId });
  } catch (error) {
    return internalError(error);
  }
}
