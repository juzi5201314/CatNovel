"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getToolCatalogItem,
  getToolNameByAlias,
  type ToolCatalogItem,
  type ToolParameterSchema,
} from "@/core/tools/tool-catalog";

type ChatRole = "user" | "assistant";
type ToolCallStatus = "planned" | "executed" | "requires_approval" | "failed" | "unknown";

type ToolCallItem = {
  id: string;
  toolName: string;
  status: ToolCallStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  approvalId?: string;
};

type ContextHitItem = {
  chapterNo: number;
  chapterId: string;
  chunkId: string;
  score: number;
  snippet: string;
};

type ContextEventItem = {
  eventId: string;
  entityId: string;
  chapterNo: number;
  title: string;
  description: string;
  confidence: number;
  status: string;
};

type ContextUsedItem = {
  usedGraphRag: boolean;
  hits: ContextHitItem[];
  events: ContextEventItem[];
};

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type ApiResult<T> = ApiSuccess<T> | ApiFailure;

type ApprovalDetail = {
  toolName: string;
  status: string;
};

type JsonSchemaNode = {
  type?: string;
  enum?: unknown[];
  properties?: Record<string, unknown>;
  items?: unknown;
  required?: string[];
};

type FieldEntryKind = "primitive" | "array-primitive" | "json";

type ApprovalFieldEntry = {
  path: string[];
  label: string;
  value: unknown;
  kind: FieldEntryKind;
  schema?: JsonSchemaNode;
  required: boolean;
};

type ChatPanelProps = {
  projectId: string | null;
  chapterId: string | null;
};

type ChatSessionSummary = {
  id: string;
  projectId: string;
  chapterId: string | null;
  title: string;
  messageCount: number;
  chatTerminated: boolean;
  createdAt: string;
  updatedAt: string;
};

type ChatSessionRecord = ChatSessionSummary & {
  messages: UIMessage[];
};

const DEFAULT_CHAT_SESSION_TITLE = "新会话";
const MAX_CHAT_SESSION_TITLE_LENGTH = 40;

const NON_ADJUSTABLE_TOOLS = new Set<string>([
  "approval.approve",
  "approval.reject",
  "settings.providers.rotateKey",
  "settings.providers.delete",
  "settings.modelPresets.deleteBuiltinLocked",
]);

function shouldHideApprovalField(path: string[]): boolean {
  const tail = path[path.length - 1] ?? "";
  if (!tail) {
    return false;
  }

  if (/^(id|ids)$/i.test(tail)) {
    return true;
  }
  if (/_(id|ids)$/i.test(tail)) {
    return true;
  }
  if (/[a-z0-9]Id(s)?$/.test(tail)) {
    return true;
  }

  return false;
}

function asRecord(payload: unknown): Record<string, unknown> | null {
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isPrimitiveValue(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function asSchemaNode(value: unknown): JsonSchemaNode | undefined {
  if (!asRecord(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return {
    type: typeof record.type === "string" ? record.type : undefined,
    enum: Array.isArray(record.enum) ? record.enum : undefined,
    properties: asRecord(record.properties) ?? undefined,
    items: record.items,
    required: Array.isArray(record.required)
      ? record.required.filter((item): item is string => typeof item === "string")
      : undefined,
  };
}

function readObjectValue(value: unknown): Record<string, unknown> {
  return asRecord(value) ?? {};
}

function humanizeFieldKey(key: string): string {
  const normalized = key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length === 0) {
    return key;
  }
  return normalized[0].toUpperCase() + normalized.slice(1);
}

function mergeFieldKeys(schemaKeys: string[], valueKeys: string[]): string[] {
  const existing = new Set(schemaKeys);
  const extraKeys = valueKeys.filter((key) => !existing.has(key)).sort();
  return [...schemaKeys, ...extraKeys];
}

function formatValueForDisplay(value: unknown): string {
  if (value === undefined) {
    return "(未填写)";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return value.length > 0 ? value : "(空字符串)";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : value.map((item) => formatValueForDisplay(item)).join(", ");
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toArrayItemType(schema: JsonSchemaNode | undefined): "string" | "number" | "integer" | "boolean" | "unknown" {
  const itemSchema = asSchemaNode(schema?.items);
  if (!itemSchema?.type) {
    return "unknown";
  }
  if (
    itemSchema.type === "string" ||
    itemSchema.type === "number" ||
    itemSchema.type === "integer" ||
    itemSchema.type === "boolean"
  ) {
    return itemSchema.type;
  }
  return "unknown";
}

function canUsePrimitiveArrayEditor(value: unknown, schema: JsonSchemaNode | undefined): boolean {
  const arrayValue = Array.isArray(value) ? value : [];
  const itemType = toArrayItemType(schema);
  if (itemType !== "unknown") {
    return true;
  }
  return arrayValue.every((item) => isPrimitiveValue(item));
}

function collectApprovalFieldEntries(input: {
  value: unknown;
  schema?: JsonSchemaNode;
  path?: string[];
  labels?: string[];
  required?: boolean;
}): ApprovalFieldEntry[] {
  const {
    value,
    schema,
    path = [],
    labels = [],
    required = false,
  } = input;
  const label = labels.length > 0 ? labels.join(" / ") : "参数";

  const isObjectLike = schema?.type === "object" || (schema?.type === undefined && asRecord(value));
  if (isObjectLike) {
    const record = readObjectValue(value);
    const schemaProperties = asRecord(schema?.properties) ?? {};
    const schemaKeys = Object.keys(schemaProperties);
    const keys = mergeFieldKeys(schemaKeys, Object.keys(record));
    const requiredSet = new Set(schema?.required ?? []);

    if (keys.length === 0) {
      return [
        {
          path,
          label,
          value: record,
          kind: "json",
          schema,
          required,
        },
      ];
    }

    const entries: ApprovalFieldEntry[] = [];
    for (const key of keys) {
      entries.push(
        ...collectApprovalFieldEntries({
          value: record[key],
          schema: asSchemaNode(schemaProperties[key]),
          path: [...path, key],
          labels: [...labels, humanizeFieldKey(key)],
          required: requiredSet.has(key),
        }),
      );
    }
    return entries;
  }

  if (schema?.type === "array" || Array.isArray(value)) {
    return [
      {
        path,
        label,
        value: Array.isArray(value) ? value : [],
        kind: canUsePrimitiveArrayEditor(value, schema) ? "array-primitive" : "json",
        schema,
        required,
      },
    ];
  }

  return [
    {
      path,
      label,
      value,
      kind: "primitive",
      schema,
      required,
    },
  ];
}

function setValueAtPath(root: unknown, path: string[], nextValue: unknown): Record<string, unknown> {
  const source = readObjectValue(root);
  if (path.length === 0) {
    return readObjectValue(nextValue);
  }

  const cloned: Record<string, unknown> = { ...source };
  let cursor: Record<string, unknown> = cloned;

  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    const next = readObjectValue(cursor[key]);
    cursor[key] = { ...next };
    cursor = cursor[key] as Record<string, unknown>;
  }

  const tail = path[path.length - 1];
  if (nextValue === undefined) {
    delete cursor[tail];
  } else {
    cursor[tail] = nextValue;
  }

  return cloned;
}

function parseFieldArrayFromText(text: string, itemType: "string" | "number" | "integer" | "boolean" | "unknown"): unknown[] {
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);

  return rows.map((line) => {
    if (itemType === "number" || itemType === "integer") {
      const parsed = Number(line);
      return Number.isFinite(parsed) ? (itemType === "integer" ? Math.trunc(parsed) : parsed) : line;
    }
    if (itemType === "boolean") {
      if (line === "true") {
        return true;
      }
      if (line === "false") {
        return false;
      }
      return line;
    }
    return line;
  });
}

function parseToolInputDraftSafe(draft: string): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  try {
    const parsed = parseToolInputDraft(draft);
    if (!asRecord(parsed)) {
      return { ok: false, message: "审批参数必须是 JSON object" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, message: "审批参数 JSON 解析失败" };
  }
}

function resolveInternalToolName(toolName: string): string {
  if (toolName.includes(".")) {
    return toolName;
  }
  return getToolNameByAlias(toolName) ?? toolName;
}

function canAdjustTool(catalogItem: ToolCatalogItem | undefined): boolean {
  if (!catalogItem) {
    return true;
  }
  if (catalogItem.riskLevel === "high_risk") {
    return false;
  }
  if (NON_ADJUSTABLE_TOOLS.has(catalogItem.toolName)) {
    return false;
  }
  return true;
}

function isToolPart(part: UIMessage["parts"][number]): boolean {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

function isRequiresApprovalOutput(output: unknown): boolean {
  const record = asRecord(output);
  if (!record) {
    return false;
  }
  return asString(record.status) === "requires_approval";
}

function toolStateToStatus(state: string | undefined): ToolCallStatus {
  if (state === "input-streaming" || state === "input-available") {
    return "planned";
  }
  if (state === "approval-requested") {
    return "requires_approval";
  }
  if (state === "output-available") {
    return "executed";
  }
  if (state === "output-error" || state === "output-denied") {
    return "failed";
  }
  return "unknown";
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter(
      (part): part is Extract<typeof part, { type: "text" | "reasoning" }> =>
        part.type === "text" || part.type === "reasoning",
    )
    .map((part) => part.text)
    .join("");
}

function normalizeSessionMessages(value: unknown): UIMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: UIMessage[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }

    const role = asString(record.role);
    if (role !== "system" && role !== "user" && role !== "assistant") {
      continue;
    }

    if (!Array.isArray(record.parts)) {
      continue;
    }

    output.push({
      id: asString(record.id) ?? crypto.randomUUID(),
      role,
      parts: record.parts as UIMessage["parts"],
      metadata: record.metadata,
    });
  }

  return output;
}

function sortSessions(sessions: ChatSessionSummary[]): ChatSessionSummary[] {
  return [...sessions].sort((left, right) => {
    const leftTs = new Date(left.updatedAt).getTime();
    const rightTs = new Date(right.updatedAt).getTime();
    if (leftTs !== rightTs) {
      return rightTs - leftTs;
    }
    return right.id.localeCompare(left.id);
  });
}

function toSessionSummary(session: ChatSessionSummary | ChatSessionRecord): ChatSessionSummary {
  return {
    id: session.id,
    projectId: session.projectId,
    chapterId: session.chapterId ?? null,
    title: session.title,
    messageCount: session.messageCount,
    chatTerminated: session.chatTerminated,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function buildSessionTitle(messages: UIMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === "user");
  if (!firstUserMessage) {
    return DEFAULT_CHAT_SESSION_TITLE;
  }

  const normalized = getMessageText(firstUserMessage)
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length === 0) {
    return DEFAULT_CHAT_SESSION_TITLE;
  }

  return normalized.slice(0, MAX_CHAT_SESSION_TITLE_LENGTH);
}

function formatSessionUpdatedAt(updatedAt: string): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${min}`;
}

function normalizeToolName(partType: string, dynamicName?: string): string {
  if (partType === "dynamic-tool") {
    return dynamicName ?? "dynamic-tool";
  }
  return partType.replace(/^tool-/, "");
}

function resolveApprovalId(partRecord: Record<string, unknown>): string | undefined {
  const approval = asRecord(partRecord.approval);
  const approvalInPart = asString(approval?.id);
  if (approvalInPart) {
    return approvalInPart;
  }

  const output = asRecord(partRecord.output);
  const approvalInOutput = asString(output?.approvalId);
  return approvalInOutput ?? undefined;
}

function extractToolCalls(message: UIMessage): ToolCallItem[] {
  const output: ToolCallItem[] = [];

  for (const part of message.parts) {
    if (!isToolPart(part)) {
      continue;
    }

    const partRecord = part as Record<string, unknown>;
    const partType = String(partRecord.type ?? "dynamic-tool");
    const toolName = normalizeToolName(partType, asString(partRecord.toolName) ?? undefined);
    const state = asString(partRecord.state) ?? undefined;

    const status = isRequiresApprovalOutput(partRecord.output)
      ? "requires_approval"
      : toolStateToStatus(state);

    output.push({
      id: asString(partRecord.toolCallId) ?? crypto.randomUUID(),
      toolName,
      status,
      input: partRecord.input,
      output: partRecord.output,
      error: asString(partRecord.errorText) ?? undefined,
      approvalId: resolveApprovalId(partRecord),
    });
  }

  return output;
}

function readContextHit(item: unknown): ContextHitItem | null {
  const record = asRecord(item);
  if (!record) {
    return null;
  }

  const chapterNo = asNumber(record.chapterNo);
  const chapterId = asString(record.chapterId);
  const chunkId = asString(record.chunkId);
  const score = asNumber(record.score);
  const snippet = asString(record.snippet);
  if (
    chapterNo === null ||
    chapterId === null ||
    chunkId === null ||
    score === null ||
    snippet === null
  ) {
    return null;
  }

  return {
    chapterNo,
    chapterId,
    chunkId,
    score,
    snippet,
  };
}

function readContextEvent(item: unknown): ContextEventItem | null {
  const record = asRecord(item);
  if (!record) {
    return null;
  }

  const eventId = asString(record.eventId);
  const entityId = asString(record.entityId);
  const chapterNo = asNumber(record.chapterNo);
  const title = asString(record.title);
  const description = asString(record.description);
  const confidence = asNumber(record.confidence);
  const status = asString(record.status);
  if (
    eventId === null ||
    entityId === null ||
    chapterNo === null ||
    title === null ||
    description === null ||
    confidence === null ||
    status === null
  ) {
    return null;
  }

  return {
    eventId,
    entityId,
    chapterNo,
    title,
    description,
    confidence,
    status,
  };
}

function extractContextUsed(message: UIMessage): ContextUsedItem | null {
  for (const part of message.parts) {
    if (!isToolPart(part)) {
      continue;
    }

    const partRecord = part as Record<string, unknown>;
    const output = asRecord(partRecord.output);
    const result = asRecord(output?.result);
    if (!result) {
      continue;
    }

    if (!Array.isArray(result.hits) && !Array.isArray(result.events)) {
      continue;
    }

    const hits = Array.isArray(result.hits)
      ? result.hits
          .map((item) => readContextHit(item))
          .filter((item): item is ContextHitItem => item !== null)
      : [];
    const events = Array.isArray(result.events)
      ? result.events
          .map((item) => readContextEvent(item))
          .filter((item): item is ContextEventItem => item !== null)
      : [];

    return {
      usedGraphRag: result.usedGraphRag === true,
      hits,
      events,
    };
  }

  return null;
}

function statusText(status: ToolCallStatus): string {
  if (status === "planned") {
    return "Planned";
  }
  if (status === "executed") {
    return "Executed";
  }
  if (status === "requires_approval") {
    return "Need Approval";
  }
  if (status === "failed") {
    return "Failed";
  }
  return "Unknown";
}

function statusClassName(status: ToolCallStatus): string {
  if (status === "executed") {
    return "text-green-700 bg-green-100 border-green-200";
  }
  if (status === "requires_approval") {
    return "text-amber-700 bg-amber-100 border-amber-200";
  }
  if (status === "failed") {
    return "text-red-700 bg-red-100 border-red-200";
  }
  if (status === "planned") {
    return "text-blue-700 bg-blue-100 border-blue-200";
  }
  return "text-muted-foreground bg-muted border-border";
}

function toDisplayRole(role: UIMessage["role"]): ChatRole {
  return role === "user" ? "user" : "assistant";
}

function stringifyToolInput(input: unknown): string {
  try {
    return JSON.stringify(input ?? {}, null, 2) ?? "{}";
  } catch {
    return "{}";
  }
}

function parseToolInputDraft(draft: string): unknown {
  const normalized = draft.trim();
  if (normalized.length === 0) {
    return {};
  }

  return JSON.parse(normalized);
}

function shouldAutoContinueAfterTools(messages: UIMessage[], terminated: boolean): boolean {
  if (terminated) {
    return false;
  }

  const message = messages[messages.length - 1];
  if (!message || message.role !== "assistant") {
    return false;
  }

  const toolParts = message.parts.filter((part) => isToolPart(part));
  if (toolParts.length === 0) {
    return false;
  }

  return toolParts.every((part) => {
    const partRecord = part as Record<string, unknown>;
    const state = asString(partRecord.state);
    if (!state) {
      return false;
    }

    if (
      state === "input-streaming" ||
      state === "input-available" ||
      state === "approval-requested" ||
      state === "approval-responded"
    ) {
      return false;
    }

    if (state === "output-available") {
      return !isRequiresApprovalOutput(partRecord.output);
    }

    return state === "output-error" || state === "output-denied";
  });
}

async function parseApiData<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok || !payload.success) {
    if (!payload.success) {
      throw new Error(payload.error.message);
    }
    throw new Error("request failed");
  }
  return payload.data;
}

function readExecutionResult(payload: unknown): unknown {
  const record = asRecord(payload);
  if (!record) {
    throw new Error("工具执行响应格式不正确");
  }

  if (record.status === "executed") {
    return record.result;
  }

  if (record.status === "requires_approval") {
    throw new Error("审批通过后执行仍返回 requires_approval");
  }

  throw new Error("未知工具执行状态");
}

function readApprovalDetail(payload: unknown): ApprovalDetail {
  const record = asRecord(payload);
  if (!record) {
    throw new Error("审批详情格式不正确");
  }

  const toolName = asString(record.toolName);
  if (!toolName) {
    throw new Error("审批详情缺少 toolName");
  }

  const status = asString(record.status);
  if (!status) {
    throw new Error("审批详情缺少 status");
  }

  return {
    toolName,
    status,
  };
}

export function ChatPanel({ projectId, chapterId }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [chatTerminated, setChatTerminated] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [restoringSessionId, setRestoringSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [busyApprovalId, setBusyApprovalId] = useState<string | null>(null);
  const [editingApprovalId, setEditingApprovalId] = useState<string | null>(null);
  const [approvalDrafts, setApprovalDrafts] = useState<Record<string, string>>({});
  const [approvalErrors, setApprovalErrors] = useState<Record<string, string>>({});
  const [collapsedApprovals, setCollapsedApprovals] = useState<Record<string, boolean>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const latestMessagesRef = useRef<UIMessage[]>([]);
  const latestChatTerminatedRef = useRef(false);
  const activeSessionIdRef = useRef<string | null>(null);

  const resetApprovalUi = useCallback(() => {
    setBusyApprovalId(null);
    setEditingApprovalId(null);
    setApprovalDrafts({});
    setApprovalErrors({});
    setCollapsedApprovals({});
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: {
          projectId,
          chapterId: chapterId ?? undefined,
          retrieval: { enableGraph: "auto", topK: 8 },
        },
      }),
    [chapterId, projectId],
  );

  const sendAutomaticallyWhen = useCallback(
    ({ messages }: { messages: UIMessage[] }) =>
      shouldAutoContinueAfterTools(messages, chatTerminated),
    [chatTerminated],
  );

  const { messages, setMessages, sendMessage, stop, status, error, addToolOutput } = useChat({
    id: `chat-${projectId ?? "none"}-${activeSessionId ?? "none"}`,
    transport,
    sendAutomaticallyWhen,
  });

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );

  const isStreaming = status === "submitted" || status === "streaming";
  const loadingSessionData = loadingSessions || restoringSessionId !== null;
  const canSend =
    Boolean(projectId) &&
    Boolean(activeSessionId) &&
    input.trim().length > 0 &&
    !isStreaming &&
    !chatTerminated &&
    !loadingSessionData;

  useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    latestChatTerminatedRef.current = chatTerminated;
  }, [chatTerminated]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const fetchSessionList = useCallback(async (): Promise<ChatSessionSummary[]> => {
    if (!projectId) {
      return [];
    }

    const searchParams = new URLSearchParams({ projectId });
    const response = await fetch(`/api/ai/sessions?${searchParams.toString()}`, {
      method: "GET",
    });
    const listed = await parseApiData<ChatSessionSummary[]>(response);
    return sortSessions(listed.map((session) => toSessionSummary(session)));
  }, [projectId]);

  const fetchSessionById = useCallback(async (sessionId: string): Promise<ChatSessionRecord> => {
    const response = await fetch(`/api/ai/sessions/${sessionId}`, {
      method: "GET",
    });
    const session = await parseApiData<ChatSessionRecord>(response);
    return {
      ...session,
      chapterId: session.chapterId ?? null,
      messages: normalizeSessionMessages(session.messages),
    };
  }, []);

  const createSessionOnServer = useCallback(async (): Promise<ChatSessionRecord> => {
    if (!projectId) {
      throw new Error("projectId is required");
    }

    const response = await fetch("/api/ai/sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        chapterId: chapterId ?? null,
        title: DEFAULT_CHAT_SESSION_TITLE,
        messages: [],
        chatTerminated: false,
      }),
    });
    const created = await parseApiData<ChatSessionRecord>(response);
    return {
      ...created,
      chapterId: created.chapterId ?? null,
      messages: normalizeSessionMessages(created.messages),
    };
  }, [chapterId, projectId]);

  const persistSession = useCallback(
    async (inputPayload: {
      sessionId: string;
      messages: UIMessage[];
      chatTerminated: boolean;
    }): Promise<void> => {
      const response = await fetch(`/api/ai/sessions/${inputPayload.sessionId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: buildSessionTitle(inputPayload.messages),
          messages: inputPayload.messages,
          chatTerminated: inputPayload.chatTerminated,
        }),
      });
      const updated = await parseApiData<ChatSessionRecord>(response);
      const summary = toSessionSummary(updated);
      setSessions((current) => {
        const rest = current.filter((session) => session.id !== summary.id);
        return sortSessions([summary, ...rest]);
      });
    },
    [],
  );

  const applySessionToUi = useCallback(
    (session: ChatSessionRecord) => {
      stop();
      resetApprovalUi();
      setInput("");
      setActiveSessionId(session.id);
      setMessages(normalizeSessionMessages(session.messages));
      setChatTerminated(session.chatTerminated);
    },
    [resetApprovalUi, setMessages, stop],
  );

  // 会话引导仅在 scope 切换时触发，避免 active session 切换时重复重建。
  useEffect(() => {
    let cancelled = false;

    async function bootstrapSessions() {
      stop();
      setSessionError(null);
      setShowHistoryPanel(false);
      setInput("");
      resetApprovalUi();
      setChatTerminated(false);
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);

      if (!projectId) {
        return;
      }

      setLoadingSessions(true);
      try {
        const listed = await fetchSessionList();
        if (cancelled) {
          return;
        }

        if (listed.length === 0) {
          const created = await createSessionOnServer();
          if (cancelled) {
            return;
          }
          setSessions([toSessionSummary(created)]);
          applySessionToUi(created);
          return;
        }

        const restored = await fetchSessionById(listed[0].id);
        if (cancelled) {
          return;
        }
        setSessions(listed);
        applySessionToUi(restored);
      } catch (reasonUnknown) {
        if (cancelled) {
          return;
        }
        const message = reasonUnknown instanceof Error ? reasonUnknown.message : "加载历史会话失败";
        setSessionError(message);
      } finally {
        if (!cancelled) {
          setLoadingSessions(false);
        }
      }
    }

    void bootstrapSessions();

    return () => {
      cancelled = true;
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!projectId || !activeSessionId || loadingSessionData || deletingSessionId) {
      return;
    }

    const timer = window.setTimeout(() => {
      void persistSession({
        sessionId: activeSessionId,
        messages,
        chatTerminated,
      }).catch((reasonUnknown) => {
        const message = reasonUnknown instanceof Error ? reasonUnknown.message : "保存会话失败";
        setSessionError(message);
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    activeSessionId,
    chatTerminated,
    deletingSessionId,
    loadingSessionData,
    messages,
    persistSession,
    projectId,
  ]);

  const handleCreateSession = useCallback(async () => {
    if (!projectId || loadingSessionData) {
      return;
    }

    try {
      if (activeSessionIdRef.current) {
        await persistSession({
          sessionId: activeSessionIdRef.current,
          messages: latestMessagesRef.current,
          chatTerminated: latestChatTerminatedRef.current,
        });
      }

      const created = await createSessionOnServer();
      setSessions((current) => sortSessions([toSessionSummary(created), ...current]));
      applySessionToUi(created);
      setShowHistoryPanel(false);
      setSessionError(null);
    } catch (reasonUnknown) {
      const message = reasonUnknown instanceof Error ? reasonUnknown.message : "创建会话失败";
      setSessionError(message);
    }
  }, [applySessionToUi, createSessionOnServer, loadingSessionData, persistSession, projectId]);

  const handleRestoreSession = useCallback(
    async (sessionId: string) => {
      if (!projectId || loadingSessionData || sessionId === activeSessionIdRef.current) {
        setShowHistoryPanel(false);
        return;
      }

      setRestoringSessionId(sessionId);
      try {
        if (activeSessionIdRef.current) {
          await persistSession({
            sessionId: activeSessionIdRef.current,
            messages: latestMessagesRef.current,
            chatTerminated: latestChatTerminatedRef.current,
          });
        }

        const restored = await fetchSessionById(sessionId);
        setSessions((current) => {
          const next = current.filter((session) => session.id !== restored.id);
          return sortSessions([toSessionSummary(restored), ...next]);
        });
        applySessionToUi(restored);
        setShowHistoryPanel(false);
        setSessionError(null);
      } catch (reasonUnknown) {
        const message = reasonUnknown instanceof Error ? reasonUnknown.message : "恢复会话失败";
        setSessionError(message);
      } finally {
        setRestoringSessionId(null);
      }
    },
    [applySessionToUi, fetchSessionById, loadingSessionData, persistSession, projectId],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (!projectId || deletingSessionId || loadingSessionData) {
        return;
      }

      setDeletingSessionId(sessionId);
      try {
        const response = await fetch(`/api/ai/sessions/${sessionId}`, {
          method: "DELETE",
        });
        await parseApiData<{ deleted: boolean }>(response);

        const wasActive = activeSessionIdRef.current === sessionId;
        if (!wasActive) {
          setSessions((current) => current.filter((session) => session.id !== sessionId));
          setSessionError(null);
          return;
        }

        const listed = await fetchSessionList();
        if (listed.length === 0) {
          const created = await createSessionOnServer();
          setSessions([toSessionSummary(created)]);
          applySessionToUi(created);
          setSessionError(null);
          return;
        }

        const restored = await fetchSessionById(listed[0].id);
        setSessions(listed);
        applySessionToUi(restored);
        setSessionError(null);
      } catch (reasonUnknown) {
        const message = reasonUnknown instanceof Error ? reasonUnknown.message : "删除会话失败";
        setSessionError(message);
      } finally {
        setDeletingSessionId(null);
      }
    },
    [
      applySessionToUi,
      createSessionOnServer,
      deletingSessionId,
      fetchSessionById,
      fetchSessionList,
      loadingSessionData,
      projectId,
    ],
  );

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const submitPrompt = useCallback(async () => {
    if (!canSend) {
      return;
    }

    const prompt = input.trim();
    setInput("");
    await sendMessage({ text: prompt });
    setTimeout(scrollToBottom, 0);
  }, [canSend, input, scrollToBottom, sendMessage]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      await submitPrompt();
    },
    [submitPrompt],
  );

  const ensureDraft = useCallback((call: ToolCallItem) => {
    if (!call.approvalId) {
      return;
    }

    setApprovalDrafts((current) => {
      if (current[call.approvalId as string] !== undefined) {
        return current;
      }
      return {
        ...current,
        [call.approvalId as string]: stringifyToolInput(call.input),
      };
    });
  }, []);

  const updateDraftField = useCallback(
    (approvalId: string, path: string[], nextValue: unknown) => {
      setApprovalDrafts((current) => {
        const raw = current[approvalId] ?? "{}";
        const parsed = parseToolInputDraftSafe(raw);
        if (!parsed.ok) {
          return current;
        }

        const nextObject = setValueAtPath(parsed.value, path, nextValue);
        return {
          ...current,
          [approvalId]: JSON.stringify(nextObject, null, 2),
        };
      });
    },
    [],
  );

  const approveAndExecute = useCallback(
    async (call: ToolCallItem, args: unknown, reason?: string) => {
      if (!projectId) {
        throw new Error("projectId is required");
      }
      if (!call.approvalId) {
        throw new Error("审批 ID 缺失，无法执行");
      }

      const approvalId = call.approvalId;
      setBusyApprovalId(approvalId);
      setApprovalErrors((current) => ({
        ...current,
        [approvalId]: "",
      }));

      try {
        const detailResponse = await fetch(`/api/tool-approvals/${approvalId}`, {
          method: "GET",
        });
        const detailPayload = await parseApiData<unknown>(detailResponse);
        const detail = readApprovalDetail(detailPayload);

        if (detail.status === "executed") {
          setCollapsedApprovals((current) => ({
            ...current,
            [approvalId]: true,
          }));
          setEditingApprovalId((current) => (current === approvalId ? null : current));
          return;
        }
        if (detail.status === "rejected" || detail.status === "expired") {
          throw new Error(`审批状态不可执行：${detail.status}`);
        }

        if (detail.status === "pending") {
          const approveResponse = await fetch(`/api/tool-approvals/${approvalId}/approve`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify(reason ? { comment: reason } : {}),
          });
          await parseApiData<{ status: string }>(approveResponse);
        } else if (detail.status !== "approved") {
          throw new Error(`未知审批状态：${detail.status}`);
        }

        const executeResponse = await fetch("/api/tools/execute", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            projectId,
            toolName: detail.toolName,
            args,
            approvalId,
            caller: "llm",
          }),
        });

        const executionPayload = await parseApiData<unknown>(executeResponse);
        const executionResult = readExecutionResult(executionPayload);

        await addToolOutput({
          tool: call.toolName as never,
          toolCallId: call.id,
          output: executionResult as never,
        });

        setCollapsedApprovals((current) => ({
          ...current,
          [approvalId]: true,
        }));
        setEditingApprovalId((current) => (current === approvalId ? null : current));
      } catch (reasonUnknown) {
        const message = reasonUnknown instanceof Error ? reasonUnknown.message : "审批执行失败";
        setApprovalErrors((current) => ({
          ...current,
          [approvalId]: message,
        }));
      } finally {
        setBusyApprovalId((current) => (current === approvalId ? null : current));
      }
    },
    [addToolOutput, projectId],
  );

  const handleApprove = useCallback(
    async (call: ToolCallItem) => {
      await approveAndExecute(call, call.input ?? {});
    },
    [approveAndExecute],
  );

  const handleStartAdjust = useCallback(
    (call: ToolCallItem) => {
      if (!call.approvalId) {
        return;
      }
      ensureDraft(call);
      setEditingApprovalId(call.approvalId);
      setApprovalErrors((current) => ({
        ...current,
        [call.approvalId as string]: "",
      }));
    },
    [ensureDraft],
  );

  const handleConfirmAdjust = useCallback(
    async (call: ToolCallItem) => {
      if (!call.approvalId) {
        return;
      }

      const approvalId = call.approvalId;
      const draft = approvalDrafts[approvalId] ?? stringifyToolInput(call.input);
      const parsedResult = parseToolInputDraftSafe(draft);
      if (!parsedResult.ok) {
        setApprovalErrors((current) => ({
          ...current,
          [approvalId]: parsedResult.message,
        }));
        return;
      }

      await approveAndExecute(call, parsedResult.value, "Approved with manual adjustment");
    },
    [approvalDrafts, approveAndExecute],
  );

  const handleReject = useCallback(
    async (call: ToolCallItem) => {
      if (!call.approvalId) {
        return;
      }

      const approvalId = call.approvalId;
      setBusyApprovalId(approvalId);
      setApprovalErrors((current) => ({
        ...current,
        [approvalId]: "",
      }));

      try {
        const rejectResponse = await fetch(`/api/tool-approvals/${approvalId}/reject`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ reason: "Rejected in chat inline approval" }),
        });
        await parseApiData<{ status: string }>(rejectResponse);

        setChatTerminated(true);
        stop();

        await addToolOutput({
          state: "output-error",
          tool: call.toolName as never,
          toolCallId: call.id,
          errorText: "用户已拒绝该写入操作，对话已终止。",
        });

        setCollapsedApprovals((current) => ({
          ...current,
          [approvalId]: true,
        }));
        setEditingApprovalId((current) => (current === approvalId ? null : current));
      } catch (reasonUnknown) {
        const message = reasonUnknown instanceof Error ? reasonUnknown.message : "审批拒绝失败";
        setApprovalErrors((current) => ({
          ...current,
          [approvalId]: message,
        }));
      } finally {
        setBusyApprovalId((current) => (current === approvalId ? null : current));
      }
    },
    [addToolOutput, stop],
  );

  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Chat</h3>
          <div className="truncate text-[11px] text-muted-foreground">
            {activeSession ? activeSession.title : loadingSessions ? "会话加载中..." : "暂无会话"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-tighter"
            onClick={() => setShowHistoryPanel((current) => !current)}
            disabled={!projectId || loadingSessionData}
          >
            History
          </button>
          {isStreaming && (
            <button
              className="text-[10px] px-2 py-0.5 text-red-600 hover:bg-red-50 transition-colors font-bold uppercase tracking-tighter"
              onClick={stop}
            >
              Stop
            </button>
          )}
        </div>

        {showHistoryPanel ? (
          <div className="absolute right-0 top-8 z-20 w-80 rounded-xl border border-border bg-background p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Sessions
              </span>
              <button
                type="button"
                className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-tighter"
                onClick={() => {
                  void handleCreateSession();
                }}
                disabled={!projectId || loadingSessionData}
              >
                New
              </button>
            </div>

            <div className="max-h-64 space-y-1 overflow-y-auto custom-scrollbar pr-1">
              {sessions.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-2 py-3 text-[11px] text-muted-foreground">
                  暂无历史会话
                </div>
              ) : (
                sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  const restoring = restoringSessionId === session.id;
                  const deleting = deletingSessionId === session.id;

                  return (
                    <div
                      key={session.id}
                      className={`w-full rounded-md border px-2 py-2 transition-colors ${
                        isActive
                          ? "border-accent bg-accent/5"
                          : "border-border hover:border-foreground/20 hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            void handleRestoreSession(session.id);
                          }}
                          disabled={restoring || deleting || loadingSessionData}
                        >
                          <div className="truncate text-[11px] font-medium">
                            {session.title || DEFAULT_CHAT_SESSION_TITLE}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatSessionUpdatedAt(session.updatedAt)} · {session.messageCount} msgs
                          </div>
                        </button>
                        <button
                          type="button"
                          className="h-6 w-6 shrink-0 rounded-full border border-border text-[10px] text-red-600 hover:bg-red-50"
                          onClick={() => {
                            void handleDeleteSession(session.id);
                          }}
                          disabled={deleting || loadingSessionData}
                          title="删除会话"
                          aria-label="删除会话"
                        >
                          ×
                        </button>
                      </div>
                      {restoring ? (
                        <div className="mt-1 text-[10px] text-muted-foreground">恢复中...</div>
                      ) : null}
                      {deleting ? (
                        <div className="mt-1 text-[10px] text-muted-foreground">删除中...</div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>

      {chatTerminated ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          当前对话已终止（你拒绝了写入工具调用）。
        </div>
      ) : null}

      {sessionError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          {sessionError}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 space-y-6 overflow-y-auto pr-2 custom-scrollbar py-2"
      >
        {loadingSessionData ? (
          <div className="py-10 text-center text-xs text-muted-foreground">会话加载中...</div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto opacity-20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-xs text-muted-foreground font-medium px-8 leading-relaxed">
              Ask anything about your story, characters, or plot consistency.
            </p>
            <div className="flex flex-wrap justify-center gap-2 px-4">
              {["Outline this chapter", "Check character arc", "Twist suggestions"].map((s) => (
                <button
                  key={s}
                  className="text-[10px] px-3 py-1.5 bg-muted/50 hover:bg-accent hover:text-accent-foreground rounded-full transition-all border border-border/50 font-medium"
                  onClick={() => setInput(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages
            .filter((message) => message.role !== "system")
            .map((message) => {
              const role = toDisplayRole(message.role);
              const content = getMessageText(message);
              const toolCalls = role === "assistant" ? extractToolCalls(message) : [];
              const contextUsed = role === "assistant" ? extractContextUsed(message) : null;

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 animate-in fade-in slide-in-from-bottom-1 duration-300 ${role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black border shadow-sm ${
                      role === "user"
                        ? "bg-background border-border text-foreground"
                        : "bg-foreground border-foreground text-background"
                    }`}
                  >
                    {role === "user" ? "U" : "AI"}
                  </div>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm border transition-all ${
                      role === "user"
                        ? "bg-foreground text-background rounded-tr-none border-foreground"
                        : "bg-muted/50 text-foreground rounded-tl-none border-border"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">
                      {content || (isStreaming && role === "assistant" ? <span className="animate-pulse">Thinking...</span> : null)}
                    </div>

                    {role === "assistant" ? (
                      <div className="mt-3 space-y-2 border-t border-border/60 pt-2">
                        {contextUsed ? (
                          <div className="rounded-xl border border-border/70 bg-background/70 p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                              <span>Context</span>
                              <span>{contextUsed.usedGraphRag ? "Graph RAG" : "Vector RAG"}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Hits {contextUsed.hits.length} · Events {contextUsed.events.length}
                            </div>
                            {contextUsed.hits.slice(0, 2).map((hit) => (
                              <div key={hit.chunkId} className="text-[11px] text-foreground/90">
                                <span className="font-semibold">Ch.{hit.chapterNo}</span>
                                <span className="text-muted-foreground"> ({hit.chapterId}) </span>
                                <span className="text-muted-foreground">score {hit.score.toFixed(2)}</span>
                                <div className="text-foreground/80">{hit.snippet}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {toolCalls.length > 0 ? (
                          <div className="rounded-xl border border-border/70 bg-background/70 p-2.5 space-y-2">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Tools</div>
                            {toolCalls.map((call) => {
                              const approvalId = call.approvalId;
                              const internalToolName = resolveInternalToolName(call.toolName);
                              const catalogItem = getToolCatalogItem(internalToolName);
                              const toolSchema = asSchemaNode(catalogItem?.parameters as ToolParameterSchema | undefined);
                              const adjustable = canAdjustTool(catalogItem);
                              const isApprovalCall = call.status === "requires_approval" && Boolean(approvalId);
                              const isCollapsed = approvalId ? collapsedApprovals[approvalId] === true : false;
                              const isEditing = approvalId ? editingApprovalId === approvalId : false;
                              const approvalError = approvalId ? approvalErrors[approvalId] : undefined;
                              const draft = approvalId
                                ? (approvalDrafts[approvalId] ?? stringifyToolInput(call.input))
                                : stringifyToolInput(call.input);
                              const approvalBusy = approvalId ? busyApprovalId === approvalId : false;
                              const parsedDraft = parseToolInputDraftSafe(draft);
                              const fields = parsedDraft.ok
                                ? collectApprovalFieldEntries({
                                    value: parsedDraft.value,
                                    schema: toolSchema,
                                  })
                                : [];
                              const visibleFields = fields.filter((field) => !shouldHideApprovalField(field.path));
                              const hiddenFieldCount = Math.max(0, fields.length - visibleFields.length);
                              const hasVisibleFieldEntries = visibleFields.length > 0;
                              const adjustableInView = adjustable && (hasVisibleFieldEntries || !parsedDraft.ok);

                              return (
                                <div key={call.id} className="rounded-lg border border-border bg-muted/20 p-2 space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex flex-col">
                                      <span className="font-mono text-[11px] text-foreground">{internalToolName}</span>
                                      {internalToolName !== call.toolName ? (
                                        <span className="font-mono text-[10px] text-muted-foreground">
                                          alias: {call.toolName}
                                        </span>
                                      ) : null}
                                    </div>
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusClassName(call.status)}`}
                                    >
                                      {statusText(call.status)}
                                    </span>
                                  </div>
                                  {approvalId ? (
                                    <div className="text-[11px] text-muted-foreground">
                                      approvalId: <span className="font-mono">{approvalId}</span>
                                    </div>
                                  ) : null}
                                  {call.error ? (
                                    <div className="text-[11px] text-red-600">{call.error}</div>
                                  ) : null}

                                  {isApprovalCall ? (
                                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/60 p-2 space-y-2">
                                      {isCollapsed ? (
                                        <div className="text-[11px] text-amber-700">审批已处理，卡片已折叠。</div>
                                      ) : (
                                        <>
                                          <div className="text-[11px] text-amber-800">该写入工具调用等待你确认。</div>
                                          <div className="text-[11px] text-amber-700/90">
                                            {adjustableInView ? "支持字段级微调" : "该工具不支持微调，仅可同意/拒绝"}
                                          </div>
                                          {hiddenFieldCount > 0 ? (
                                            <div className="text-[11px] text-amber-700/80">
                                              已隐藏 {hiddenFieldCount} 个系统字段（如各类 ID）。
                                            </div>
                                          ) : null}
                                          <div className="text-[10px] uppercase tracking-wide text-amber-700/80">写入参数</div>

                                          {parsedDraft.ok ? (
                                            hasVisibleFieldEntries ? (
                                              <div className="max-h-72 space-y-2 overflow-auto pr-1">
                                                {visibleFields.map((field) => {
                                                  const fieldKey = field.path.join(".") || "root";
                                                  const stringEnums = Array.isArray(field.schema?.enum)
                                                    ? field.schema?.enum
                                                        .filter((item): item is string => typeof item === "string")
                                                    : [];
                                                  const fieldType = field.schema?.type;
                                                  const fieldTail = field.path[field.path.length - 1]?.toLowerCase() ?? "";
                                                  const preferMultiline = /content|description|summary|evidence|note|reason/.test(fieldTail);

                                                  return (
                                                    <div
                                                      key={`${call.id}-${fieldKey}`}
                                                      className="rounded-md border border-amber-200/80 bg-white/80 p-2"
                                                    >
                                                      <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-amber-900">
                                                        <span>{field.label}</span>
                                                        {field.required ? <span className="text-red-600">*</span> : null}
                                                      </div>

                                                      {isEditing ? (
                                                        field.kind === "primitive" ? (
                                                          fieldType === "boolean" ? (
                                                            <label className="inline-flex items-center gap-2 text-[11px] text-foreground">
                                                              <input
                                                                type="checkbox"
                                                                checked={field.value === true}
                                                                onChange={(event) => {
                                                                  if (!approvalId) {
                                                                    return;
                                                                  }
                                                                  updateDraftField(approvalId, field.path, event.target.checked);
                                                                }}
                                                                disabled={approvalBusy}
                                                              />
                                                              <span>{field.value === true ? "true" : "false"}</span>
                                                            </label>
                                                          ) : fieldType === "number" || fieldType === "integer" ? (
                                                            <input
                                                              type="number"
                                                              step={fieldType === "integer" ? 1 : "any"}
                                                              value={field.value === undefined || field.value === null ? "" : String(field.value)}
                                                              onChange={(event) => {
                                                                if (!approvalId) {
                                                                  return;
                                                                }
                                                                const raw = event.target.value.trim();
                                                                if (raw.length === 0) {
                                                                  updateDraftField(approvalId, field.path, undefined);
                                                                  return;
                                                                }
                                                                const parsed = Number(raw);
                                                                if (!Number.isFinite(parsed)) {
                                                                  return;
                                                                }
                                                                updateDraftField(
                                                                  approvalId,
                                                                  field.path,
                                                                  fieldType === "integer" ? Math.trunc(parsed) : parsed,
                                                                );
                                                              }}
                                                              className="w-full rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px]"
                                                              disabled={approvalBusy}
                                                            />
                                                          ) : stringEnums.length > 0 ? (
                                                            <select
                                                              value={typeof field.value === "string" ? field.value : ""}
                                                              onChange={(event) => {
                                                                if (!approvalId) {
                                                                  return;
                                                                }
                                                                updateDraftField(approvalId, field.path, event.target.value);
                                                              }}
                                                              className="w-full rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px]"
                                                              disabled={approvalBusy}
                                                            >
                                                              <option value="">(未填写)</option>
                                                              {stringEnums.map((option) => (
                                                                <option key={option} value={option}>
                                                                  {option}
                                                                </option>
                                                              ))}
                                                            </select>
                                                          ) : preferMultiline ? (
                                                            <textarea
                                                              rows={4}
                                                              value={typeof field.value === "string" ? field.value : ""}
                                                              onChange={(event) => {
                                                                if (!approvalId) {
                                                                  return;
                                                                }
                                                                updateDraftField(approvalId, field.path, event.target.value);
                                                              }}
                                                              className="w-full resize-y rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px]"
                                                              disabled={approvalBusy}
                                                            />
                                                          ) : (
                                                            <input
                                                              type="text"
                                                              value={field.value === undefined || field.value === null ? "" : String(field.value)}
                                                              onChange={(event) => {
                                                                if (!approvalId) {
                                                                  return;
                                                                }
                                                                updateDraftField(approvalId, field.path, event.target.value);
                                                              }}
                                                              className="w-full rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px]"
                                                              disabled={approvalBusy}
                                                            />
                                                          )
                                                        ) : field.kind === "array-primitive" ? (
                                                          <textarea
                                                            rows={Math.max(3, Math.min(8, Array.isArray(field.value) ? field.value.length + 1 : 3))}
                                                            value={Array.isArray(field.value) ? field.value.map((item) => String(item ?? "")).join("\n") : ""}
                                                            onChange={(event) => {
                                                              if (!approvalId) {
                                                                return;
                                                              }
                                                              const itemType = toArrayItemType(field.schema);
                                                              const nextArray = parseFieldArrayFromText(event.target.value, itemType);
                                                              updateDraftField(approvalId, field.path, nextArray);
                                                            }}
                                                            className="w-full resize-y rounded-md border border-amber-200 bg-white px-2 py-1 font-mono text-[11px]"
                                                            disabled={approvalBusy}
                                                          />
                                                        ) : (
                                                          <textarea
                                                            key={`${approvalId}-${fieldKey}`}
                                                            defaultValue={JSON.stringify(field.value ?? {}, null, 2)}
                                                            rows={6}
                                                            onBlur={(event) => {
                                                              if (!approvalId) {
                                                                return;
                                                              }
                                                              try {
                                                                const parsed = JSON.parse(event.target.value);
                                                                updateDraftField(approvalId, field.path, parsed);
                                                              } catch {
                                                                setApprovalErrors((current) => ({
                                                                  ...current,
                                                                  [approvalId]: `${field.label} 不是合法 JSON`,
                                                                }));
                                                              }
                                                            }}
                                                            className="w-full resize-y rounded-md border border-amber-200 bg-white px-2 py-1 font-mono text-[11px]"
                                                            disabled={approvalBusy}
                                                          />
                                                        )
                                                      ) : field.kind === "json" ? (
                                                        <pre className="max-h-52 overflow-auto rounded-md border border-amber-200 bg-white p-2 font-mono text-[11px] whitespace-pre-wrap break-all">
                                                          {JSON.stringify(field.value ?? {}, null, 2)}
                                                        </pre>
                                                      ) : (
                                                        <div className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] whitespace-pre-wrap break-all">
                                                          {formatValueForDisplay(field.value)}
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            ) : (
                                              <div className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] text-muted-foreground">
                                                {hiddenFieldCount > 0 ? "(参数均为系统字段，已隐藏)" : "(无参数)"}
                                              </div>
                                            )
                                          ) : (
                                            <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
                                              参数解析失败，请重试或重新生成该工具调用。
                                            </div>
                                          )}

                                          {!parsedDraft.ok ? (
                                            <div className="text-[11px] text-red-600">{parsedDraft.message}</div>
                                          ) : null}

                                          {approvalError && approvalError.trim().length > 0 ? (
                                            <div className="text-[11px] text-red-600">{approvalError}</div>
                                          ) : null}

                                          <div className="flex flex-wrap gap-2">
                                            <button
                                              type="button"
                                              disabled={approvalBusy || !approvalId}
                                              onClick={() => {
                                                void handleApprove(call);
                                              }}
                                            >
                                              {approvalBusy ? "处理中..." : "同意"}
                                            </button>
                                            <button
                                              type="button"
                                              disabled={approvalBusy || !approvalId}
                                              onClick={() => {
                                                void handleReject(call);
                                              }}
                                            >
                                              拒绝
                                            </button>
                                            {adjustableInView ? (
                                              isEditing ? (
                                                <button
                                                  type="button"
                                                  disabled={approvalBusy || !approvalId}
                                                  onClick={() => {
                                                    void handleConfirmAdjust(call);
                                                  }}
                                                >
                                                  确认微调
                                                </button>
                                              ) : (
                                                <button
                                                  type="button"
                                                  disabled={approvalBusy || !approvalId}
                                                  onClick={() => {
                                                    handleStartAdjust(call);
                                                  }}
                                                >
                                                  手动微调
                                                </button>
                                              )
                                            ) : null}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  ) : null}

                                  {call.status === "requires_approval" && !call.approvalId ? (
                                    <div className="text-[11px] text-red-600">缺少 approvalId，无法审批。</div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
        )}
        {error && (
          <div className="text-[10px] font-bold text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error.message}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="relative group">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) {
                void submitPrompt();
              }
            }
          }}
          placeholder={
            loadingSessionData
              ? "会话加载中..."
              : chatTerminated
                ? "当前对话已终止"
                : "Message AI Assistant..."
          }
          rows={3}
          className="w-full pr-12 resize-none bg-muted/20 focus:bg-background transition-all rounded-2xl border border-border p-4 outline-none focus:ring-4 ring-accent/5 text-sm leading-relaxed"
          disabled={!projectId || !activeSessionId || isStreaming || chatTerminated || loadingSessionData}
        />
        <div className="absolute right-3 bottom-3 flex items-center gap-3">
          <kbd className="hidden md:inline-flex opacity-0 group-focus-within:opacity-30 transition-opacity bg-transparent border-none shadow-none text-[9px] font-black">ENTER</kbd>
          <button
            type="submit"
            disabled={!canSend}
            className="p-2 rounded-xl primary disabled:opacity-20 transition-all shadow-xl shadow-black/10 hover:shadow-accent/20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="m5 12 7-7 7 7M12 19V5" />
            </svg>
          </button>
        </div>
      </form>
    </section>
  );
}
