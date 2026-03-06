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
import { WorldbuildingRepository } from "@/repositories/worldbuilding-repository";

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

function buildWorldbuildingContext(projectId: string): string {
  try {
    const repo = new WorldbuildingRepository();
    const rootNodes = repo.getRootNodes(projectId);
    if (rootNodes.length === 0) return "";

    const sections = rootNodes
      .filter((n) => n.description.trim().length > 0)
      .map((n) => `## ${n.name}\n${n.description}`)
      .join("\n\n");

    if (!sections) return "";
    return `\n\n# \u4e16\u754c\u89c2\u8bbe\u5b9a\uff08\u81ea\u52a8\u6ce8\u5165\uff09\n\n${sections}`;
  } catch {
    return "";
  }
}

function toChatSystemPrompt(projectId: string): string {
  const worldbuildingContext = buildWorldbuildingContext(projectId);

  return [
    resolveProjectSystemPrompt(projectId),
    "\u4f60\u662f CatNovel \u7684\u5199\u4f5c\u52a9\u7406\u3002\u53ef\u4ee5\u4f7f\u7528\u5185\u7f6e\u5de5\u5177\u67e5\u8be2\u7ae0\u8282\u3001\u65f6\u95f4\u7ebf\u3001\u8bbe\u5b9a\u3001\u5feb\u7167\u4e0e\u5ba1\u6279\u4fe1\u606f\u3002",
    "\u51e1\u662f\u6d89\u53ca\u9879\u76ee\u4e8b\u5b9e\u6570\u636e\u7684\u95ee\u9898\uff0c\u4f18\u5148\u8c03\u7528\u5de5\u5177\u518d\u56de\u7b54\uff0c\u4e0d\u8981\u7f16\u9020\u3002",
    "\u5f53\u5de5\u5177\u8fd4\u56de requires_approval \u65f6\uff0c\u63d0\u793a\u7528\u6237\u5728\u5f53\u524d\u804a\u5929\u4e2d\u7684\u5ba1\u6279\u5361\u7247\u5b8c\u6210\u540c\u610f/\u62d2\u7edd/\u5fae\u8c03\u3002",
    "\u5f53\u7528\u6237\u8981\u6c42\u201c\u5217\u51fa\u53ef\u7528\u5de5\u5177\u201d\u65f6\uff0c\u5fc5\u987b\u8c03\u7528 system.listTools\u3002",
    "\u5f53\u7528\u6237\u8be2\u95ee\u201c\u6709\u591a\u5c11\u7ae0/\u51e0\u7ae0\u201d\u65f6\uff0c\u5fc5\u987b\u8c03\u7528 chapter.list \u540e\u6839\u636e count \u56de\u7b54\u3002",
    "\u5f53\u7528\u6237\u8be2\u95ee\u8bbe\u5b9a\u96c6\u5185\u5bb9\u65f6\uff0c\u5fc5\u987b\u8c03\u7528 lore.listNodes\u3002",
    "\u4f60\u53ef\u4ee5\u4f7f\u7528 lore.searchNodes \u5de5\u5177\u6309\u5173\u952e\u8bcd\u641c\u7d22\u6df1\u5c42\u8bbe\u5b9a\u8282\u70b9\u3002",
    worldbuildingContext,
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
    return `\u5f53\u524d\u9879\u76ee\u5171\u6709 ${count} \u7ae0\u3002`;
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
    return [`\u5f53\u524d\u53ef\u7528\u5de5\u5177\u5171 ${count} \u4e2a\uff1a`, ...tools].join("\n");
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
            const description = asString(row.description) ?? "";
            const parentId = asString(row.parentId);
            return {
              name,
              description,
              parentId,
            };
          })
          .filter(
            (
              item,
            ): item is { name: string; description: string; parentId: string | null } =>
              item !== null,
          )
      : [];

    if (nodes.length === 0) {
      return "\u5f53\u524d\u8bbe\u5b9a\u96c6\u6682\u65e0\u6761\u76ee\u3002";
    }

    const maxRows = Math.min(nodes.length, 30);
    const lines = nodes.slice(0, maxRows).map((node, index) => {
      const depthLabel = node.parentId ? "\u5b50\u8282\u70b9" : "\u6839\u8282\u70b9";
      const descText =
        node.description.trim().length > 0
          ? `\uff1b\u63cf\u8ff0\uff1a${node.description.trim().slice(0, 100)}`
          : "";
      return `${index + 1}. ${node.name}\uff08${depthLabel}\uff09${descText}`;
    });
    const total = asNumber(record.count) ?? nodes.length;
    const suffix = total > maxRows ? `\n\u4ec5\u5c55\u793a\u524d ${maxRows} \u6761\uff0c\u5171 ${total} \u6761\u3002` : "";
    return [`\u5f53\u524d\u8bbe\u5b9a\u96c6\u5171\u6709 ${total} \u4e2a\u8282\u70b9\uff1a`, ...lines].join("\n") + suffix;
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
      ? renderForcedToolFallback(input.forcedToolName, toolResult.result) ?? "\u5de5\u5177\u8c03\u7528\u5df2\u5b8c\u6210\u3002"
      : `\u8be5\u5de5\u5177\u8c03\u7528\u9700\u8981\u5ba1\u6279\uff0c\u8bf7\u5728\u5f53\u524d\u804a\u5929\u4e2d\u7684\u5ba1\u6279\u5361\u7247\u5904\u7406\u540e\u518d\u7ee7\u7eed\u3002approvalId=${toolResult.approvalId}`;

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
