import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

import {
  buildManagedTools,
  isValidChatApiFormat,
  resolveAiRuntime,
} from "@/core/ai-runtime";
import { parseThinkingBudget, resolveProjectSystemPrompt } from "@/core/llm";
import { fail, internalError, parseJsonBody } from "@/lib/http/api-response";

type GenerateTaskType = "continue" | "rewrite" | "polish" | "expand";

type GenerateRequestInput = {
  projectId: string;
  chapterId?: string;
  taskType: GenerateTaskType;
  prompt: string;
  selection?: string;
  chatPresetId?: string;
  override?: {
    apiFormat?: "chat_completions" | "responses";
    baseURL?: string;
    modelId?: string;
    thinkingBudget?: unknown;
  };
};

type ValidationOk = { ok: true; data: GenerateRequestInput };
type ValidationFailed = { ok: false; response: Response };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function isTaskType(value: unknown): value is GenerateTaskType {
  return value === "continue" || value === "rewrite" || value === "polish" || value === "expand";
}

function validateGenerateBody(payload: unknown): ValidationOk | ValidationFailed {
  const record = asRecord(payload);
  if (!record) {
    return { ok: false, response: fail("INVALID_INPUT", "Body must be an object", 400) };
  }

  const projectId = record.projectId;
  const taskType = record.taskType;
  const prompt = record.prompt;

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

  const override = record.override;
  if (override !== undefined && !asRecord(override)) {
    return { ok: false, response: fail("INVALID_INPUT", "override must be an object", 400) };
  }

  const overrideRecord = asRecord(override) ?? {};
  if (
    overrideRecord.apiFormat !== undefined &&
    !isValidChatApiFormat(overrideRecord.apiFormat)
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

  if (
    overrideRecord.baseURL !== undefined &&
    (typeof overrideRecord.baseURL !== "string" || overrideRecord.baseURL.trim().length === 0)
  ) {
    return {
      ok: false,
      response: fail("INVALID_INPUT", "override.baseURL must be non-empty string", 400),
    };
  }

  if (
    overrideRecord.modelId !== undefined &&
    (typeof overrideRecord.modelId !== "string" || overrideRecord.modelId.trim().length === 0)
  ) {
    return {
      ok: false,
      response: fail("INVALID_INPUT", "override.modelId must be non-empty string", 400),
    };
  }

  const thinkingBudgetResult = parseThinkingBudget(overrideRecord.thinkingBudget);
  if (!thinkingBudgetResult.ok) {
    return {
      ok: false,
      response: fail("INVALID_INPUT", thinkingBudgetResult.message, 400),
    };
  }

  return {
    ok: true,
    data: {
      projectId: projectId.trim(),
      chapterId: typeof record.chapterId === "string" ? record.chapterId : undefined,
      taskType,
      prompt: prompt.trim(),
      selection: typeof record.selection === "string" ? record.selection : undefined,
      chatPresetId: typeof record.chatPresetId === "string" ? record.chatPresetId : undefined,
      override: {
        apiFormat: isValidChatApiFormat(overrideRecord.apiFormat)
          ? overrideRecord.apiFormat
          : undefined,
        baseURL: typeof overrideRecord.baseURL === "string" ? overrideRecord.baseURL : undefined,
        modelId: typeof overrideRecord.modelId === "string" ? overrideRecord.modelId : undefined,
        thinkingBudget: thinkingBudgetResult.data,
      },
    },
  };
}

function taskInstruction(taskType: GenerateTaskType): string {
  switch (taskType) {
    case "continue":
      return "基于上下文继续写作，推进剧情并保持节奏连贯。";
    case "rewrite":
      return "在不改变核心信息的前提下重写文本，优化叙述结构与表达。";
    case "polish":
      return "润色语言细节，提升可读性与情绪感染力。";
    case "expand":
      return "在原意基础上扩写内容，补足细节与感官描写。";
    default:
      return "按要求完成写作任务。";
  }
}

function buildGeneratePrompt(input: GenerateRequestInput): string {
  const selection = input.selection?.trim();
  return [
    `任务类型：${input.taskType}`,
    `任务说明：${taskInstruction(input.taskType)}`,
    selection ? `选中文本：\n${selection}` : "选中文本：无（基于章节上下文执行）",
    `补充要求：${input.prompt.trim()}`,
    "输出要求：直接输出最终文本，不要解释思路。",
  ].join("\n\n");
}

function toGenerateSystemPrompt(projectId: string): string {
  return [
    resolveProjectSystemPrompt(projectId),
    "你是小说写作执行助手。",
    "输出必须是可直接使用的正文文本，避免多余解释。",
    "当需要核对章节事实时可以调用内置工具。",
  ].join("\n\n");
}

function toModelInputMessages(messages: UIMessage[]): Array<Omit<UIMessage, "id">> {
  return messages.map((message) => ({
    role: message.role,
    parts: message.parts,
    metadata: message.metadata,
  }));
}

export async function POST(request: Request): Promise<Response> {
  try {
    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const validated = validateGenerateBody(bodyResult.data);
    if (!validated.ok) {
      return validated.response;
    }

    const runtime = resolveAiRuntime({
      projectId: validated.data.projectId,
      chatPresetId: validated.data.chatPresetId,
      override: validated.data.override,
    });

    const toolsBundle = buildManagedTools({
      projectId: validated.data.projectId,
      chapterId: validated.data.chapterId,
    });

    const userPrompt = buildGeneratePrompt(validated.data);
    const originalMessages: UIMessage[] = [
      {
        id: crypto.randomUUID(),
        role: "user",
        parts: [
          {
            type: "text",
            text: userPrompt,
          },
        ],
      },
    ];

    const modelMessages = await convertToModelMessages(toModelInputMessages(originalMessages));

    const result = streamText({
      model: runtime.model,
      system: toGenerateSystemPrompt(validated.data.projectId),
      messages: modelMessages,
      tools: toolsBundle.tools,
      toolChoice: "auto",
      temperature: runtime.callSettings.temperature,
      maxOutputTokens: runtime.callSettings.maxOutputTokens,
      // 注意：当前网关会拒绝 previous_response_id，providerOptions 中禁止注入 previousResponseId。
      providerOptions: runtime.callSettings.providerOptions,
      stopWhen: stepCountIs(6),
      maxRetries: 0,
      abortSignal: request.signal,
    });

    return result.toUIMessageStreamResponse({
      originalMessages,
    });
  } catch (error) {
    return internalError(error);
  }
}
