import { fail } from "@/lib/http/api-response";
import { createSseResponse } from "@/lib/ai/sse";
import {
  isValidApiFormat,
  prepareGenerateStream,
  runGenerateStream,
  type GenerateRequestInput,
} from "@/mastra";
import type { GenerateTaskType } from "@/mastra/workflows/generate-workflow";

type ValidationOk = { ok: true; data: GenerateRequestInput };
type ValidationFailed = { ok: false; response: Response };

function isTaskType(value: unknown): value is GenerateTaskType {
  return (
    value === "continue" ||
    value === "rewrite" ||
    value === "polish" ||
    value === "expand"
  );
}

function validateGenerateBody(payload: unknown): ValidationOk | ValidationFailed {
  if (!payload || typeof payload !== "object") {
    return { ok: false, response: fail("INVALID_INPUT", "Body must be an object", 400) };
  }

  const record = payload as Record<string, unknown>;
  const projectId = record.projectId;
  const chapterId = record.chapterId;
  const taskType = record.taskType;
  const prompt = record.prompt;
  const selection = record.selection;
  const chatPresetId = record.chatPresetId;
  const override = record.override;

  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    return { ok: false, response: fail("INVALID_INPUT", "projectId is required", 400) };
  }

  if (!isTaskType(taskType)) {
    return {
      ok: false,
      response: fail(
        "INVALID_INPUT",
        "taskType must be continue/rewrite/polish/expand",
        400,
      ),
    };
  }

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return { ok: false, response: fail("INVALID_INPUT", "prompt is required", 400) };
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

  return {
    ok: true,
    data: {
      projectId,
      chapterId: typeof chapterId === "string" ? chapterId : undefined,
      taskType,
      prompt: prompt.trim(),
      selection: typeof selection === "string" ? selection : undefined,
      chatPresetId: typeof chatPresetId === "string" ? chatPresetId : undefined,
      override: {
        apiFormat: isValidApiFormat(overrideRecord.apiFormat)
          ? overrideRecord.apiFormat
          : undefined,
        baseURL: typeof overrideRecord.baseURL === "string" ? overrideRecord.baseURL : undefined,
        modelId: typeof overrideRecord.modelId === "string" ? overrideRecord.modelId : undefined,
        thinkingBudget: overrideRecord.thinkingBudget,
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

  const validated = validateGenerateBody(body);
  if (!validated.ok) {
    return validated.response;
  }

  return createSseResponse(request.signal, async (writer, signal) => {
    const prepared = await prepareGenerateStream(validated.data);
    writer.emit("tool_call", prepared.toolCall);
    writer.emit("context_used", prepared.contextUsed);

    let index = 0;
    for await (const token of runGenerateStream(validated.data, signal)) {
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
  });
}
