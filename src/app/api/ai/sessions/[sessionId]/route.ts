import { internalError, ok, fail, parseJsonBody } from "@/lib/http/api-response";
import { validatePatchChatSessionInput } from "@/lib/http/chat-session-validators";
import { ChatSessionsRepository } from "@/repositories/chat-sessions/chat-sessions-repository";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

const chatSessionsRepository = new ChatSessionsRepository();

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    if (!sessionId) {
      return fail("INVALID_PARAM", "sessionId is required", 400);
    }

    const session = chatSessionsRepository.findById(sessionId);
    if (!session) {
      return fail("NOT_FOUND", "Chat session not found", 404);
    }

    return ok(session);
  } catch (error) {
    return internalError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    if (!sessionId) {
      return fail("INVALID_PARAM", "sessionId is required", 400);
    }

    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const validation = validatePatchChatSessionInput(bodyResult.data);
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    const updated = chatSessionsRepository.updateAndGet(sessionId, validation.data);
    if (!updated) {
      return fail("NOT_FOUND", "Chat session not found", 404);
    }

    return ok(updated);
  } catch (error) {
    return internalError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    if (!sessionId) {
      return fail("INVALID_PARAM", "sessionId is required", 400);
    }

    const deleted = chatSessionsRepository.delete(sessionId);
    if (!deleted) {
      return fail("NOT_FOUND", "Chat session not found", 404);
    }

    return ok({ deleted: true });
  } catch (error) {
    return internalError(error);
  }
}
