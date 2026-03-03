import {
  createUIMessageStream,
  createUIMessageStreamResponse,
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
import { executeManagedTool } from "@/core/tools/tool-execution-service";
import { fail, internalError, parseJsonBody } from "@/lib/http/api-response";

type ChatRole = "system" | "user" | "assistant";

type ChatRequestInput = {
  projectId: string;
  chapterId?: string;
  messages: UIMessage[];
  chatPresetId?: string;
  retrieval?: {
    topK?: number;
    enableGraph?: "auto" | "on" | "off";
  };
  override?: {
    apiFormat?: "chat_completions" | "responses";
    baseURL?: string;
    modelId?: string;
    thinkingBudget?: unknown;
  };
};

type ValidationOk = { ok: true; data: ChatRequestInput };
type ValidationFailed = { ok: false; response: Response };

const TOOL_LIST_QUERY_REGEX =
  /列出.*(工具|tools?)|可用.*(工具|tools?)|有哪些.*(工具|tools?)|available tools|list tools|what tools/iu;
const CHAPTER_COUNT_QUERY_REGEX =
  /多少章|几章|章节数|章数|chapter count|how many chapters|number of chapters/iu;
const LORE_LIST_QUERY_REGEX =
  /(?:列出|查看|展示|读取|有哪些|有什么|list|show).*(?:设定|设定集|世界观|lore)|(?:设定|设定集|世界观|lore).*(?:列表|清单|条目|内容|有哪些|有什么|list|show)/iu;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRole(value: unknown): value is ChatRole {
  return value === "system" || value === "user" || value === "assistant";
}

function normalizeMessages(payload: unknown): ValidationOk | ValidationFailed {
  if (!Array.isArray(payload) || payload.length === 0) {
    return {
      ok: false,
      response: fail("INVALID_INPUT", "messages must be a non-empty array", 400),
    };
  }

  const messages: UIMessage[] = [];

  for (const item of payload) {
    const message = asRecord(item);
    if (!message || !isRole(message.role)) {
      return {
        ok: false,
        response: fail("INVALID_INPUT", "message.role is invalid", 400),
      };
    }

    let parts: UIMessage["parts"] | null = null;

    if (Array.isArray(message.parts)) {
      parts = message.parts as UIMessage["parts"];
    } else if (typeof message.content === "string") {
      parts = [
        {
          type: "text",
          text: message.content,
        },
      ];
    }

    if (!parts || parts.length === 0) {
      return {
        ok: false,
        response: fail("INVALID_INPUT", "message must contain text parts", 400),
      };
    }

    messages.push({
      id: typeof message.id === "string" && message.id.trim().length > 0
        ? message.id
        : crypto.randomUUID(),
      role: message.role,
      parts,
      metadata: message.metadata,
    });
  }

  return {
    ok: true,
    data: {
      projectId: "",
      messages,
    },
  };
}

function validateChatBody(payload: unknown): ValidationOk | ValidationFailed {
  const record = asRecord(payload);
  if (!record) {
    return { ok: false, response: fail("INVALID_INPUT", "Body must be an object", 400) };
  }

  const projectId = record.projectId;
  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    return { ok: false, response: fail("INVALID_INPUT", "projectId is required", 400) };
  }

  const normalizedMessages = normalizeMessages(record.messages);
  if (!normalizedMessages.ok) {
    return normalizedMessages;
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

  const retrievalRecord = asRecord(record.retrieval) ?? {};
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
      projectId: projectId.trim(),
      chapterId: typeof record.chapterId === "string" ? record.chapterId : undefined,
      chatPresetId: typeof record.chatPresetId === "string" ? record.chatPresetId : undefined,
      messages: normalizedMessages.data.messages,
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

function readLastUserMessage(messages: UIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") {
      continue;
    }

    const text = message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();

    if (text.length > 0) {
      return text;
    }
  }

  return "";
}

function toModelInputMessages(messages: UIMessage[]): Array<Omit<UIMessage, "id">> {
  return messages.map((message) => ({
    role: message.role,
    parts: message.parts,
    metadata: message.metadata,
  }));
}

function toChatSystemPrompt(projectId: string): string {
  return [
    resolveProjectSystemPrompt(projectId),
    "你是 CatNovel 的写作助理。可以使用内置工具查询章节、时间线、设定、快照与审批信息。",
    "凡是涉及项目事实数据的问题，优先调用工具再回答，不要编造。",
    "当工具返回 requires_approval 时，明确告知用户去右侧审批中心处理后再继续。",
    "当用户要求“列出可用工具”时，必须调用 system.listTools。",
    "当用户询问“有多少章/几章”时，必须调用 chapter.list 后根据 count 回答。",
    "当用户询问设定集内容时，必须调用 lore.listNodes。",
  ].join("\n\n");
}

function resolveForcedToolName(
  query: string,
): "system.listTools" | "chapter.list" | "lore.listNodes" | undefined {
  if (TOOL_LIST_QUERY_REGEX.test(query)) {
    return "system.listTools";
  }

  if (CHAPTER_COUNT_QUERY_REGEX.test(query)) {
    return "chapter.list";
  }

  if (LORE_LIST_QUERY_REGEX.test(query)) {
    return "lore.listNodes";
  }

  return undefined;
}

function renderForcedToolFallback(
  forcedToolName: "system.listTools" | "chapter.list" | "lore.listNodes",
  result: unknown,
): string | null {
  const record = asRecord(result);
  if (!record) {
    return null;
  }

  if (forcedToolName === "chapter.list") {
    const count =
      asNumber(record.count) ??
      (Array.isArray(record.chapters) ? record.chapters.length : null);
    if (count === null) {
      return null;
    }
    return `当前项目共有 ${count} 章。`;
  }

  if (forcedToolName === "system.listTools") {
    const tools = Array.isArray(record.tools)
      ? record.tools
          .map((item) => {
            const row = asRecord(item);
            if (!row) {
              return null;
            }
            const toolName = asString(row.toolName);
            if (!toolName) {
              return null;
            }
            const riskLevel = asString(row.riskLevel) ?? "unknown";
            return `${toolName} [${riskLevel}]`;
          })
          .filter((item): item is string => item !== null)
      : [];

    if (tools.length === 0) {
      return null;
    }

    const count = asNumber(record.count) ?? tools.length;
    return [`当前可用工具共 ${count} 个：`, ...tools].join("\n");
  }

  if (forcedToolName === "lore.listNodes") {
    const nodes = Array.isArray(record.nodes)
      ? record.nodes
          .map((item) => {
            const row = asRecord(item);
            if (!row) {
              return null;
            }
            const name = asString(row.name);
            if (!name) {
              return null;
            }
            const type = asString(row.type) ?? "other";
            const description = asString(row.description) ?? "";
            const aliases = Array.isArray(row.aliases)
              ? row.aliases
                  .map((aliasItem) => {
                    const alias = asRecord(aliasItem);
                    const aliasText = asString(alias?.alias);
                    return aliasText && aliasText.trim().length > 0 ? aliasText : null;
                  })
                  .filter((item): item is string => item !== null)
              : [];
            return {
              name,
              type,
              description,
              aliases,
            };
          })
          .filter(
            (
              item,
            ): item is { name: string; type: string; description: string; aliases: string[] } =>
              item !== null,
          )
      : [];

    if (nodes.length === 0) {
      return "当前设定集暂无条目。";
    }

    const maxRows = Math.min(nodes.length, 30);
    const lines = nodes.slice(0, maxRows).map((node, index) => {
      const aliasText =
        node.aliases.length > 0
          ? `；别名：${node.aliases.slice(0, 3).join("、")}`
          : "";
      const descText =
        node.description.trim().length > 0 ? `；描述：${node.description.trim()}` : "";
      return `${index + 1}. ${node.name}（${node.type}）${aliasText}${descText}`;
    });
    const total = asNumber(record.count) ?? nodes.length;
    const suffix = total > maxRows ? `\n仅展示前 ${maxRows} 条，共 ${total} 条。` : "";
    return [`当前设定集共有 ${total} 条：`, ...lines].join("\n") + suffix;
  }

  return null;
}

async function streamForcedToolResponse(input: {
  projectId: string;
  chapterId?: string;
  forcedToolName: "system.listTools" | "chapter.list" | "lore.listNodes";
}): Promise<Response> {
  const args: Record<string, unknown> = {};
  if (
    input.chapterId &&
    (input.forcedToolName.startsWith("chapter.") || input.forcedToolName.startsWith("timeline."))
  ) {
    args.chapterId = input.chapterId;
  }

  const toolResult = await executeManagedTool({
    projectId: input.projectId,
    toolName: input.forcedToolName,
    args,
  });

  const text =
    toolResult.status === "executed"
      ? renderForcedToolFallback(input.forcedToolName, toolResult.result) ?? "工具调用已完成。"
      : `该工具调用需要审批，请在审批中心处理后再继续。approvalId=${toolResult.approvalId}`;

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "start", messageId: crypto.randomUUID() });
      const textId = crypto.randomUUID();
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: text });
      writer.write({ type: "text-end", id: textId });
      writer.write({ type: "finish", finishReason: "stop" });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const validated = validateChatBody(bodyResult.data);
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

    const forcedToolName = resolveForcedToolName(readLastUserMessage(validated.data.messages));
    if (forcedToolName) {
      return await streamForcedToolResponse({
        projectId: validated.data.projectId,
        chapterId: validated.data.chapterId,
        forcedToolName,
      });
    }

    const modelMessages = await convertToModelMessages(toModelInputMessages(validated.data.messages));

    const result = streamText({
      model: runtime.model,
      system: toChatSystemPrompt(validated.data.projectId),
      messages: modelMessages,
      tools: toolsBundle.tools,
      toolChoice: "auto",
      temperature: runtime.callSettings.temperature,
      maxOutputTokens: runtime.callSettings.maxOutputTokens,
      // 注意：当前网关会拒绝 previous_response_id，providerOptions 中禁止注入 previousResponseId。
      providerOptions: runtime.callSettings.providerOptions,
      stopWhen: stepCountIs(8),
      maxRetries: 0,
      abortSignal: request.signal,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: validated.data.messages,
    });
  } catch (error) {
    return internalError(error);
  }
}
