import { internalError, ok, fail, parseJsonBody } from "@/lib/http/api-response";
import { validateCreateChapterInput } from "@/lib/http/validators";
import { ChaptersRepository } from "@/repositories/chapters-repository";
import { ProjectsRepository } from "@/repositories/projects-repository";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

const chaptersRepository = new ChaptersRepository();
const projectsRepository = new ProjectsRepository();

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
    return ok(chapters);
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

    const validation = validateCreateChapterInput(bodyResult.data);
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    const orderNo = validation.data.order ?? chaptersRepository.getNextOrderNo(projectId);

    const chapter = chaptersRepository.create({
      id: crypto.randomUUID(),
      projectId,
      orderNo,
      title: validation.data.title,
      content: "",
      summary: null,
    });

    return ok(chapter, 201);
  } catch (error) {
    return internalError(error);
  }
}
