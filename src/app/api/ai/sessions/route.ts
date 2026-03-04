import { internalError, ok, fail, parseJsonBody } from "@/lib/http/api-response";
import {
  validateChatSessionScope,
  validateCreateChatSessionInput,
} from "@/lib/http/chat-session-validators";
import { ChatSessionsRepository } from "@/repositories/chat-sessions/chat-sessions-repository";

const chatSessionsRepository = new ChatSessionsRepository();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const validation = validateChatSessionScope({
      projectId: url.searchParams.get("projectId"),
    });
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    const sessions = chatSessionsRepository.listByScope(validation.data);
    return ok(sessions);
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

    const validation = validateCreateChatSessionInput(bodyResult.data);
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    const created = chatSessionsRepository.create({
      id: crypto.randomUUID(),
      projectId: validation.data.projectId,
      chapterId: validation.data.chapterId,
      title: validation.data.title,
      messages: validation.data.messages,
      chatTerminated: validation.data.chatTerminated,
    });

    return ok(created, 201);
  } catch (error) {
    return internalError(error);
  }
}
