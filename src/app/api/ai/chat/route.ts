import { fail } from "@/lib/http/api-response";
import { createSseResponse } from "@/lib/ai/sse";
import { parseThinkingBudget, toStreamErrorPayload } from "@/core/llm";
import {
  isValidApiFormat,
  prepareChatMessages,
  prepareChatStream,
  runChatStream,
  type ChatRequestInput,
} from "@/mastra";
import type { ChatMessage } from "@/mastra/agents/chat-agent";

type ValidationOk = { ok: true; data: ChatRequestInput };
type ValidationFailed = { ok: false; response: Response };

function isRole(value: unknown): value is ChatMessage["role"] {
  return value === "system" || value === "user" || value === "assistant";
}

function validateChatBody(payload: unknown): ValidationOk | ValidationFailed {
  if (!payload || typeof payload !== "object") {
    return { ok: false, response: fail("INVALID_INPUT", "Body must be an object", 400) };
  }

  const record = payload as Record<string, unknown>;
  const projectId = record.projectId;
  const chapterId = record.chapterId;
  const chatPresetId = record.chatPresetId;
  const retrieval = record.retrieval;
  const override = record.override;
  const messagesRaw = record.messages;

  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    return { ok: false, response: fail("INVALID_INPUT", "projectId is required", 400) };
  }

  if (!Array.isArray(messagesRaw) || messagesRaw.length === 0) {
    return { ok: false, response: fail("INVALID_INPUT", "messages must be a non-empty array", 400) };
  }

  const messages: ChatMessage[] = [];
  for (const item of messagesRaw) {
    if (!item || typeof item !== "object") {
      return { ok: false, response: fail("INVALID_INPUT", "message item must be object", 400) };
    }

    const message = item as Record<string, unknown>;
    if (!isRole(message.role)) {
      return { ok: false, response: fail("INVALID_INPUT", "message.role is invalid", 400) };
    }
    if (typeof message.content !== "string") {
      return { ok: false, response: fail("INVALID_INPUT", "message.content must be string", 400) };
    }

    messages.push({
      role: message.role,
      content: message.content,
    });
  }

  if (override && typeof override !== "object") {
    return { ok: false, response: fail("INVALID_INPUT", "override must be an object", 400) };
  }

  const overrideRecord = (override ?? {}) as Record<string, unknown>;
  if (
    overrideRecord.apiFormat !== undefined &&
    !isValidApiFormat(overrideRecord.apiFormat)
  ) {
    return {
      ok: false,
      response: fail(
        "INVALID_INPUT",
        "override.apiFormat must be chat_completions or responses",
        400,
      ),
    };
  }

  if ("baseURL" in overrideRecord) {
    if (
      typeof overrideRecord.baseURL !== "string" ||
      overrideRecord.baseURL.trim().length === 0
    ) {
      return {
        ok: false,
        response: fail("INVALID_INPUT", "override.baseURL must be non-empty string", 400),
      };
    }
  }

  if ("modelId" in overrideRecord) {
    if (
      typeof overrideRecord.modelId !== "string" ||
      overrideRecord.modelId.trim().length === 0
    ) {
      return {
        ok: false,
        response: fail("INVALID_INPUT", "override.modelId must be non-empty string", 400),
      };
    }
  }

  const thinkingBudgetResult = parseThinkingBudget(overrideRecord.thinkingBudget);
  if (!thinkingBudgetResult.ok) {
    return {
      ok: false,
      response: fail("INVALID_INPUT", thinkingBudgetResult.message, 400),
    };
  }

  const retrievalRecord = (retrieval ?? {}) as Record<string, unknown>;
  const topK = retrievalRecord.topK;
  if (topK !== undefined && (!Number.isInteger(topK) || (topK as number) <= 0)) {
    return {
      ok: false,
      response: fail("INVALID_INPUT", "retrieval.topK must be a positive integer", 400),
    };
  }

  return {
    ok: true,
    data: {
      projectId,
      chapterId: typeof chapterId === "string" ? chapterId : undefined,
      messages,
      chatPresetId: typeof chatPresetId === "string" ? chatPresetId : undefined,
      retrieval: {
        topK: Number.isInteger(topK) ? (topK as number) : undefined,
        enableGraph:
          retrievalRecord.enableGraph === "on" ||
          retrievalRecord.enableGraph === "off" ||
          retrievalRecord.enableGraph === "auto"
            ? retrievalRecord.enableGraph
            : undefined,
      },
      override: {
        apiFormat: isValidApiFormat(overrideRecord.apiFormat)
          ? overrideRecord.apiFormat
          : undefined,
        baseURL: typeof overrideRecord.baseURL === "string" ? overrideRecord.baseURL : undefined,
        modelId: typeof overrideRecord.modelId === "string" ? overrideRecord.modelId : undefined,
        thinkingBudget: thinkingBudgetResult.data,
      },
    },
  };
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("INVALID_JSON", "Body must be valid JSON", 400);
  }

  const validated = validateChatBody(body);
  if (!validated.ok) {
    return validated.response;
  }

  return createSseResponse(request.signal, async (writer, signal) => {
    try {
      const prepared = await prepareChatStream(validated.data);
      writer.emit("tool_call", prepared.toolCall);
      writer.emit("context_used", prepared.contextUsed);

      const preparedMessages = await prepareChatMessages(validated.data, signal);
      for (const toolEvent of preparedMessages.toolEvents) {
        writer.emit("tool_call", toolEvent);
      }

      let index = 0;
      for await (const token of runChatStream(
        {
          ...validated.data,
          messages: preparedMessages.messages,
        },
        signal,
      )) {
        if (signal.aborted) {
          return;
        }
        writer.emit("token", {
          index,
          text: token,
        });
        index += 1;
      }

      writer.emit("done", { finishReason: "stop" });
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      writer.emit("error", toStreamErrorPayload(error));
      writer.emit("done", { finishReason: "error" });
    }
  });
}
