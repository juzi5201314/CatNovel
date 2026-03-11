import { createUIMessageStreamResponse } from "ai";

import {
  createChatSessionRunStream,
  hasChatSessionRunInRuntime,
  markStaleRunAsFailed,
} from "@/core/ai-runtime";
import { fail, internalError } from "@/lib/http/api-response";
import { ChatSessionRunsRepository } from "@/repositories/chat-sessions/chat-session-runs-repository";
import { ChatSessionsRepository } from "@/repositories/chat-sessions/chat-sessions-repository";

const chatSessionsRepository = new ChatSessionsRepository();
const chatSessionRunsRepository = new ChatSessionRunsRepository();

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    const sessionId = url.searchParams.get("sessionId");

    if (!projectId || !sessionId) {
      return fail("INVALID_QUERY", "projectId and sessionId are required", 400);
    }

    const session = chatSessionsRepository.findById(sessionId);
    if (!session) {
      return fail("NOT_FOUND", "chat session not found", 404);
    }
    if (session.projectId !== projectId) {
      return fail("INVALID_QUERY", "chat session does not belong to current project", 400);
    }

    const activeRun = chatSessionRunsRepository.findLatestActiveBySessionId(sessionId);
    if (!activeRun) {
      return new Response(null, { status: 204 });
    }

    if (!hasChatSessionRunInRuntime(activeRun.id)) {
      markStaleRunAsFailed(activeRun.id);
      return new Response(null, { status: 204 });
    }

    return createUIMessageStreamResponse({
      stream: createChatSessionRunStream(activeRun.id),
    });
  } catch (error) {
    return internalError(error);
  }
}
