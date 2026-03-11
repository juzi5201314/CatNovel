import { hasChatSessionRunInRuntime, markStaleRunAsFailed } from "@/core/ai-runtime";
import { fail, internalError, ok } from "@/lib/http/api-response";
import { ChatSessionRunsRepository } from "@/repositories/chat-sessions/chat-session-runs-repository";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

const chatSessionRunsRepository = new ChatSessionRunsRepository();

function toRunSummary(run: ReturnType<ChatSessionRunsRepository["findById"]>) {
  if (!run) {
    return null;
  }

  const status = run.status === "queued" ? "queued" : "running";

  return {
    id: run.id,
    sessionId: run.sessionId,
    projectId: run.projectId,
    chapterId: run.chapterId,
    status,
    stopRequested: run.stopRequested,
    errorMessage: run.errorMessage,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    startedAt: run.startedAt ? run.startedAt.toISOString() : null,
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    if (!sessionId) {
      return fail("INVALID_PARAM", "sessionId is required", 400);
    }

    const activeRun = chatSessionRunsRepository.findLatestActiveBySessionId(sessionId);
    if (!activeRun) {
      return ok(null);
    }

    if (!hasChatSessionRunInRuntime(activeRun.id)) {
      markStaleRunAsFailed(activeRun.id);
      return ok(null);
    }

    return ok(toRunSummary(activeRun));
  } catch (error) {
    return internalError(error);
  }
}
