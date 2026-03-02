import { internalError, ok, fail } from "@/lib/http/api-response";
import { PROJECT_EXPORT_SCHEMA_VERSION } from "@/lib/http/import-validators";
import { ChaptersRepository } from "@/repositories/chapters-repository";
import { ProjectsRepository } from "@/repositories/projects-repository";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

const projectsRepository = new ProjectsRepository();
const chaptersRepository = new ChaptersRepository();

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

    const chapters = chaptersRepository.listByProject(projectId);

    return ok({
      schemaVersion: PROJECT_EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        mode: project.mode,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
      chapters: chapters.map((chapter) => ({
        id: chapter.id,
        orderNo: chapter.orderNo,
        title: chapter.title,
        content: chapter.content ?? "",
        summary: chapter.summary ?? null,
        createdAt: chapter.createdAt.toISOString(),
        updatedAt: chapter.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return internalError(error);
  }
}
