import { internalError, ok, fail, parseJsonBody } from "@/lib/http/api-response";
import { validatePatchChapterInput } from "@/lib/http/validators";
import { recomputeChapterTimelineEvents } from "@/core/timeline/extraction-service";
import { ProjectSnapshotsService } from "@/core/snapshots/snapshot-service";
import { ChaptersRepository } from "@/repositories/chapters-repository";

type RouteContext = {
  params: Promise<{ chapterId: string }>;
};

const chaptersRepository = new ChaptersRepository();
const snapshotsService = new ProjectSnapshotsService();

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

    const saveResult = snapshotsService.saveChapterWithAutoSnapshot(chapterId, validation.data);
    const chapter = saveResult.chapter;
    if (!chapter) {
      return fail("NOT_FOUND", "Chapter not found", 404);
    }

    const shouldRecomputeTimeline =
      validation.data.content !== undefined || validation.data.summary !== undefined;

    if (shouldRecomputeTimeline) {
      void recomputeChapterTimelineEvents({
        projectId: chapter.projectId,
        chapterId: chapter.id,
        chapterNo: chapter.orderNo,
        chapterTitle: chapter.title,
        chapterContent: chapter.content ?? "",
        chapterSummary: chapter.summary ?? null,
      }).catch(() => {});
    }

    return ok(chapter);
  } catch (error) {
    return internalError(error);
  }
}
