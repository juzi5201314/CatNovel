"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type ChatPanelProps = {
  projectId: string | null;
  chapterId: string | null;
};

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
  const [busyApprovalId, setBusyApprovalId] = useState<string | null>(null);
  const [editingApprovalId, setEditingApprovalId] = useState<string | null>(null);
  const [approvalDrafts, setApprovalDrafts] = useState<Record<string, string>>({});
  const [approvalErrors, setApprovalErrors] = useState<Record<string, string>>({});
  const [collapsedApprovals, setCollapsedApprovals] = useState<Record<string, boolean>>({});

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChatTerminated(false);
    setBusyApprovalId(null);
    setEditingApprovalId(null);
    setApprovalDrafts({});
    setApprovalErrors({});
    setCollapsedApprovals({});
  }, [chapterId, projectId]);

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

  const { messages, sendMessage, stop, status, error, addToolOutput } = useChat({
    id: `chat-${projectId ?? "none"}-${chapterId ?? "none"}`,
    transport,
    sendAutomaticallyWhen,
  });

  const isStreaming = status === "submitted" || status === "streaming";
  const canSend = Boolean(projectId) && input.trim().length > 0 && !isStreaming && !chatTerminated;

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

      let parsedArgs: unknown;
      try {
        parsedArgs = parseToolInputDraft(draft);
      } catch {
        setApprovalErrors((current) => ({
          ...current,
          [approvalId]: "微调内容必须是合法 JSON。",
        }));
        return;
      }

      await approveAndExecute(call, parsedArgs, "Approved with manual adjustment");
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
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Chat</h3>
        {isStreaming && (
          <button
            className="text-[10px] px-2 py-0.5 text-red-600 hover:bg-red-50 transition-colors font-bold uppercase tracking-tighter"
            onClick={stop}
          >
            Stop
          </button>
        )}
      </div>

      {chatTerminated ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          当前对话已终止（你拒绝了写入工具调用）。
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 space-y-6 overflow-y-auto pr-2 custom-scrollbar py-2"
      >
        {messages.length === 0 ? (
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
                              const isApprovalCall = call.status === "requires_approval" && Boolean(approvalId);
                              const isCollapsed = approvalId ? collapsedApprovals[approvalId] === true : false;
                              const isEditing = approvalId ? editingApprovalId === approvalId : false;
                              const approvalError = approvalId ? approvalErrors[approvalId] : undefined;
                              const draft = approvalId
                                ? (approvalDrafts[approvalId] ?? stringifyToolInput(call.input))
                                : stringifyToolInput(call.input);
                              const approvalBusy = approvalId ? busyApprovalId === approvalId : false;

                              return (
                                <div key={call.id} className="rounded-lg border border-border bg-muted/20 p-2 space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-[11px] text-foreground">{call.toolName}</span>
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
                                          <div className="text-[10px] uppercase tracking-wide text-amber-700/80">写入参数</div>
                                          {isEditing ? (
                                            <textarea
                                              rows={8}
                                              value={draft}
                                              onChange={(event) => {
                                                if (!approvalId) {
                                                  return;
                                                }
                                                setApprovalDrafts((current) => ({
                                                  ...current,
                                                  [approvalId]: event.target.value,
                                                }));
                                              }}
                                              className="w-full resize-y rounded-md border border-amber-200 bg-white px-2 py-1 font-mono text-[11px]"
                                              disabled={approvalBusy}
                                            />
                                          ) : (
                                            <pre className="max-h-52 overflow-auto rounded-md border border-amber-200 bg-white p-2 font-mono text-[11px] whitespace-pre-wrap break-all">
                                              {draft}
                                            </pre>
                                          )}

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
                                            {isEditing ? (
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
                                            )}
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
          placeholder={chatTerminated ? "当前对话已终止" : "Message AI Assistant..."}
          rows={3}
          className="w-full pr-12 resize-none bg-muted/20 focus:bg-background transition-all rounded-2xl border border-border p-4 outline-none focus:ring-4 ring-accent/5 text-sm leading-relaxed"
          disabled={!projectId || isStreaming || chatTerminated}
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
