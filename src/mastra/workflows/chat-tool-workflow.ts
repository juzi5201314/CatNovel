import {
  streamTextFromProvider,
  type ChatMessage,
  type ChatOverride,
} from "../../core/llm";
import { resolveProjectSystemPrompt } from "../../core/llm/project-system-prompt";
import {
  executeManagedTool,
  isToolExecutionServiceError,
} from "../../core/tools/tool-execution-service";

type ToolCatalogItem = {
  toolName: string;
  riskLevel: "read" | "write" | "high_risk";
  description: string;
};

type ParsedToolCall = {
  toolName: string;
  args: Record<string, unknown>;
};

type ToolExecutionContext = {
  toolName: string;
  args: Record<string, unknown>;
};

type ExecutedToolContext = ToolExecutionContext & {
  result: unknown;
};

type PendingToolContext = ToolExecutionContext & {
  approvalId: string;
  summary: string;
};

type FailedToolContext = ToolExecutionContext & {
  error: string;
};

export type ChatToolEvent = {
  toolName: string;
  status: "planned" | "executed" | "requires_approval" | "failed";
  args: Record<string, unknown>;
  result?: unknown;
  approvalId?: string;
  summary?: string;
  error?: string;
};

export type PrepareChatMessagesWithToolsInput = {
  projectId: string;
  chapterId?: string;
  messages: ChatMessage[];
  chatPresetId?: string;
  override?: ChatOverride;
  signal: AbortSignal;
};

export type PrepareChatMessagesWithToolsResult = {
  messages: ChatMessage[];
  toolEvents: ChatToolEvent[];
};

const TOOL_PLAN_TRIGGER_REGEX =
  /时间线|timeline|实体|事件|证据|rag|检索|索引|reindex|审批|approval|工具|tool|设定|lore|节点|upsert|delete|更新|写入|修改|删除/iu;
const MAX_TOOL_CALLS = 3;

const TOOL_CATALOG: ToolCatalogItem[] = [
  {
    toolName: "rag.search",
    riskLevel: "read",
    description: "检索与问题相关的章节片段",
  },
  {
    toolName: "rag.getEvidence",
    riskLevel: "read",
    description: "获取检索命中的证据详情",
  },
  {
    toolName: "timeline.getEntity",
    riskLevel: "read",
    description: "查询实体详情与时间线",
  },
  {
    toolName: "timeline.listEvents",
    riskLevel: "read",
    description: "按项目/章节筛选时间线事件",
  },
  {
    toolName: "timeline.upsertEvent",
    riskLevel: "write",
    description: "新增或更新时间线事件（需要审批）",
  },
  {
    toolName: "timeline.editEvent",
    riskLevel: "write",
    description: "编辑既有时间线事件（需要审批）",
  },
  {
    toolName: "lore.upsertNode",
    riskLevel: "write",
    description: "新增或更新设定节点（需要审批）",
  },
  {
    toolName: "lore.deleteNode",
    riskLevel: "write",
    description: "删除设定节点（需要审批）",
  },
  {
    toolName: "rag.reindex",
    riskLevel: "write",
    description: "重建检索索引（需要审批）",
  },
];

const TOOL_NAME_SET = new Set(TOOL_CATALOG.map((item) => item.toolName));

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}...`;
}

function stringifyForPrompt(value: unknown, limit = 4000): string {
  let serialized = "";
  try {
    serialized = JSON.stringify(value, null, 2);
  } catch {
    serialized = String(value);
  }
  return truncate(serialized, limit);
}

function extractFirstJsonObject(input: string): string | null {
  const text = input.trim();
  if (text.length === 0) {
    return null;
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const candidate = fenced[1].trim();
    if (candidate.startsWith("{") || candidate.startsWith("[")) {
      return candidate;
    }
  }

  const firstBrace = text.search(/[\[{]/);
  if (firstBrace === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let index = firstBrace; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      depth += 1;
      continue;
    }

    if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }

  if (end === -1) {
    return null;
  }

  return text.slice(firstBrace, end + 1);
}

function parseArgs(rawArgs: unknown): Record<string, unknown> {
  const argsRecord = toRecord(rawArgs);
  if (argsRecord) {
    return argsRecord;
  }

  if (typeof rawArgs === "string" && rawArgs.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawArgs) as unknown;
      return toRecord(parsed) ?? {};
    } catch {
      return {};
    }
  }

  return {};
}

function normalizeToolCall(rawCall: unknown): ParsedToolCall | null {
  const record = toRecord(rawCall);
  if (!record) {
    return null;
  }

  const rawToolName = record.toolName ?? record.name;
  if (typeof rawToolName !== "string" || !TOOL_NAME_SET.has(rawToolName)) {
    return null;
  }

  return {
    toolName: rawToolName,
    args: parseArgs(record.args ?? record.arguments),
  };
}

export function parseToolPlanPayload(rawText: string): ParsedToolCall[] {
  const jsonFragment = extractFirstJsonObject(rawText);
  if (!jsonFragment) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonFragment) as unknown;
  } catch {
    return [];
  }

  const asArray = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { toolCalls?: unknown[] })?.toolCalls)
      ? ((parsed as { toolCalls: unknown[] }).toolCalls ?? [])
      : [];

  const normalized = asArray
    .map((item) => normalizeToolCall(item))
    .filter((item): item is ParsedToolCall => Boolean(item));

  return normalized.slice(0, MAX_TOOL_CALLS);
}

function applyToolArgDefaults(
  call: ParsedToolCall,
  input: PrepareChatMessagesWithToolsInput,
): ParsedToolCall {
  const args = { ...call.args };
  if (call.toolName.startsWith("timeline.") && input.chapterId && !args.chapterId) {
    args.chapterId = input.chapterId;
  }
  return {
    toolName: call.toolName,
    args,
  };
}

function lastUserMessage(messages: ChatMessage[]): string {
  return [...messages].reverse().find((item) => item.role === "user")?.content ?? "";
}

export function shouldAttemptToolPlanning(messages: ChatMessage[]): boolean {
  const query = lastUserMessage(messages).trim();
  if (query.length === 0) {
    return false;
  }
  return TOOL_PLAN_TRIGGER_REGEX.test(query);
}

function applyChatSystemPrompt(
  messages: ChatMessage[],
  systemPrompt: string,
): ChatMessage[] {
  const normalized = messages
    .filter(
      (message) =>
        typeof message.content === "string" && message.content.trim().length > 0,
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));

  const withoutSystem = normalized.filter((message) => message.role !== "system");
  return [
    { role: "system", content: systemPrompt },
    ...withoutSystem,
  ];
}

function buildToolPlannerMessages(
  input: PrepareChatMessagesWithToolsInput,
  baseMessages: ChatMessage[],
): ChatMessage[] {
  const dialogue = baseMessages
    .filter((message) => message.role !== "system")
    .slice(-8)
    .map((message) => `${message.role}: ${truncate(message.content, 400)}`)
    .join("\n\n");

  return [
    {
      role: "system",
      content: [
        "你是小说写作工作台的工具规划器。",
        "你只负责决定是否调用内置工具，不负责回答正文问题。",
        '仅输出 JSON，格式必须是 {"toolCalls":[{"toolName":"...","args":{}}]}。',
        "如果不需要工具，返回 {\"toolCalls\":[]}。",
        "最多返回 3 个工具调用。",
        "只有当用户明确要求查询/修改结构化数据时才调用工具。",
        "写操作或高风险工具只有在用户明确提出修改动作时才可使用。",
        `可用工具：${JSON.stringify(TOOL_CATALOG)}`,
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `projectId: ${input.projectId}`,
        `chapterId: ${input.chapterId ?? ""}`,
        "最近对话：",
        dialogue.length > 0 ? dialogue : "(empty)",
        "请只输出 JSON。",
      ].join("\n\n"),
    },
  ];
}

async function collectPlannerOutput(
  input: PrepareChatMessagesWithToolsInput,
  messages: ChatMessage[],
): Promise<string> {
  let output = "";
  for await (const token of streamTextFromProvider({
    requestTag: "chat",
    projectId: input.projectId,
    chatPresetId: input.chatPresetId,
    override: input.override,
    messages,
    signal: input.signal,
  })) {
    output += token;
  }
  return output.trim();
}

function buildToolContextMessage(
  executed: ExecutedToolContext[],
  pending: PendingToolContext[],
  failed: FailedToolContext[],
): string | null {
  if (executed.length === 0 && pending.length === 0 && failed.length === 0) {
    return null;
  }

  const payload = {
    executed: executed.map((item) => ({
      toolName: item.toolName,
      args: item.args,
      result: item.result,
    })),
    pendingApprovals: pending.map((item) => ({
      toolName: item.toolName,
      args: item.args,
      approvalId: item.approvalId,
      summary: item.summary,
    })),
    failed: failed.map((item) => ({
      toolName: item.toolName,
      args: item.args,
      error: item.error,
    })),
  };

  return [
    "以下是本轮内置工具的执行结果，请作为事实上下文使用：",
    stringifyForPrompt(payload),
    "如果 pendingApprovals 非空，请明确提醒用户去右侧 Tasks 的审批中心通过后再重试。",
  ].join("\n\n");
}

async function executePlannedTools(
  input: PrepareChatMessagesWithToolsInput,
  calls: ParsedToolCall[],
): Promise<{
  toolEvents: ChatToolEvent[];
  executed: ExecutedToolContext[];
  pending: PendingToolContext[];
  failed: FailedToolContext[];
}> {
  const toolEvents: ChatToolEvent[] = [];
  const executed: ExecutedToolContext[] = [];
  const pending: PendingToolContext[] = [];
  const failed: FailedToolContext[] = [];

  for (const call of calls) {
    if (input.signal.aborted) {
      break;
    }

    toolEvents.push({
      toolName: call.toolName,
      status: "planned",
      args: call.args,
    });

    try {
      const result = await executeManagedTool({
        projectId: input.projectId,
        toolName: call.toolName,
        args: call.args,
      });

      if (result.status === "requires_approval") {
        pending.push({
          toolName: call.toolName,
          args: call.args,
          approvalId: result.approvalId,
          summary: result.summary,
        });
        toolEvents.push({
          toolName: call.toolName,
          status: "requires_approval",
          args: call.args,
          approvalId: result.approvalId,
          summary: result.summary,
        });
        continue;
      }

      executed.push({
        toolName: call.toolName,
        args: call.args,
        result: result.result,
      });
      toolEvents.push({
        toolName: call.toolName,
        status: "executed",
        args: call.args,
        result: result.result,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "unknown tool execution error";

      failed.push({
        toolName: call.toolName,
        args: call.args,
        error: errorMessage,
      });
      toolEvents.push({
        toolName: call.toolName,
        status: "failed",
        args: call.args,
        error: errorMessage,
      });

      if (isToolExecutionServiceError(error)) {
        continue;
      }
    }
  }

  return {
    toolEvents,
    executed,
    pending,
    failed,
  };
}

export async function prepareChatMessagesWithTools(
  input: PrepareChatMessagesWithToolsInput,
): Promise<PrepareChatMessagesWithToolsResult> {
  const baseMessages = applyChatSystemPrompt(
    input.messages,
    resolveProjectSystemPrompt(input.projectId),
  );
  if (!shouldAttemptToolPlanning(baseMessages)) {
    return { messages: baseMessages, toolEvents: [] };
  }

  try {
    const plannerMessages = buildToolPlannerMessages(input, baseMessages);
    const plannerOutput = await collectPlannerOutput(input, plannerMessages);
    const parsedCalls = parseToolPlanPayload(plannerOutput)
      .map((item) => applyToolArgDefaults(item, input));

    if (parsedCalls.length === 0) {
      return {
        messages: baseMessages,
        toolEvents: [],
      };
    }

    const execution = await executePlannedTools(input, parsedCalls);
    const contextMessage = buildToolContextMessage(
      execution.executed,
      execution.pending,
      execution.failed,
    );

    if (!contextMessage) {
      return {
        messages: baseMessages,
        toolEvents: execution.toolEvents,
      };
    }

    return {
      messages: [...baseMessages, { role: "system", content: contextMessage }],
      toolEvents: execution.toolEvents,
    };
  } catch {
    // 工具规划失败时退回纯聊天，避免阻断主流程。
    return {
      messages: baseMessages,
      toolEvents: [],
    };
  }
}
