import { internalError, fail, ok } from "@/lib/http/api-response";
import { getProjectStatus } from "@/core/retrieval/runtime";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) {
      return fail("INVALID_QUERY", "projectId is required", 400);
    }

    const status = getProjectStatus(projectId);
    return ok({
      indexedChapters: status.indexedChapters,
      indexedChunks: status.indexedChunks,
      pendingJobs: status.pendingJobs,
      lastBuildAt: status.lastBuildAt,
    });
  } catch (error) {
    return internalError(error);
  }
}
