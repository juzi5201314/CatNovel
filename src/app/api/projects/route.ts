import { internalError, ok, fail, parseJsonBody } from "@/lib/http/api-response";
import { validateCreateProjectInput } from "@/lib/http/validators";
import { ProjectsRepository } from "@/repositories/projects-repository";

const projectsRepository = new ProjectsRepository();

export async function GET() {
  try {
    const projects = projectsRepository.list();
    return ok(projects);
  } catch (error) {
    return internalError(error);
  }
}

export async function POST(request: Request) {
  try {
    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const validation = validateCreateProjectInput(bodyResult.data);
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    const project = projectsRepository.create({
      id: crypto.randomUUID(),
      name: validation.data.name,
      mode: validation.data.mode,
    });

    return ok(project, 201);
  } catch (error) {
    return internalError(error);
  }
}
