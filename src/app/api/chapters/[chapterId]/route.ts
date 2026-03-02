import { internalError, ok, fail, parseJsonBody } from "@/lib/http/api-response";
import { validatePatchChapterInput } from "@/lib/http/validators";
import { ChaptersRepository } from "@/repositories/chapters-repository";

type RouteContext = {
  params: Promise<{ chapterId: string }>;
};

const chaptersRepository = new ChaptersRepository();

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { chapterId } = await context.params;
    if (!chapterId) {
      return fail("INVALID_PARAM", "chapterId is required", 400);
    }

    const existing = chaptersRepository.findByChapterId(chapterId);
    if (!existing) {
      return fail("NOT_FOUND", "Chapter not found", 404);
    }

    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const validation = validatePatchChapterInput(bodyResult.data);
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    const chapter = chaptersRepository.updateAndGet(chapterId, validation.data);
    if (!chapter) {
      return fail("NOT_FOUND", "Chapter not found", 404);
    }

    return ok(chapter);
  } catch (error) {
    return internalError(error);
  }
}
