import { stopChatSessionRun } from "@/core/ai-runtime";
import { fail, internalError, ok } from "@/lib/http/api-response";
import { ChatSessionRunsRepository } from "@/repositories/chat-sessions/chat-session-runs-repository";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

const chatSessionRunsRepository = new ChatSessionRunsRepository();

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    if (!runId) {
      return fail("INVALID_PARAM", "runId is required", 400);
    }

    const found = chatSessionRunsRepository.findById(runId);
    if (!found) {
      return fail("NOT_FOUND", "Chat run not found", 404);
    }

    if (found.status === "completed" || found.status === "failed" || found.status === "stopped") {
      return ok({
        id: found.id,
        status: found.status,
        stopRequested: found.stopRequested,
        stopped: false,
      });
    }

    const updated = chatSessionRunsRepository.markStopRequested(runId);
    const stoppedInRuntime = stopChatSessionRun(runId);

    return ok({
      id: runId,
      status: updated?.status ?? found.status,
      stopRequested: true,
      stopped: stoppedInRuntime,
    });
  } catch (error) {
    return internalError(error);
  }
}
