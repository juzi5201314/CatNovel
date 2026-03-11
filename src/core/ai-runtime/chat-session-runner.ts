import {
  convertToModelMessages,
  readUIMessageStream,
  stepCountIs,
  streamText,
  type LanguageModel,
  type ToolSet,
  type UIMessage,
  type UIMessageChunk,
} from "ai";

import { ChatSessionsRepository } from "@/repositories/chat-sessions/chat-sessions-repository";
import { ChatSessionRunsRepository } from "@/repositories/chat-sessions/chat-session-runs-repository";

type ChatRunStateStatus = "queued" | "running" | "completed" | "failed" | "stopped";

type ChatRunState = {
  runId: string;
  status: ChatRunStateStatus;
  stopRequested: boolean;
  closed: boolean;
  controller: AbortController;
  bufferedChunks: UIMessageChunk[];
  subscribers: Set<ReadableStreamDefaultController<UIMessageChunk>>;
};

type ChatRunRuntimeState = {
  runs: Map<string, ChatRunState>;
};

export type StartChatSessionRunInput = {
  runId: string;
  sessionId: string;
  inputMessages: UIMessage[];
  model: LanguageModel;
  systemPrompt: string;
  tools: ToolSet;
  temperature?: number;
  maxOutputTokens?: number;
  providerOptions?: Record<string, Record<string, string | number | boolean | null>>;
};

const RUNTIME_KEY = "__catnovel_chat_session_run_runtime_state__";
const runsRepository = new ChatSessionRunsRepository();
const sessionsRepository = new ChatSessionsRepository();

function getRuntime(): ChatRunRuntimeState {
  const target = globalThis as typeof globalThis & {
    [RUNTIME_KEY]?: ChatRunRuntimeState;
  };

  if (!target[RUNTIME_KEY]) {
    target[RUNTIME_KEY] = {
      runs: new Map(),
    };
  }

  return target[RUNTIME_KEY];
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

function buildSessionTitle(messages: UIMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === "user");
  if (!firstUserMessage) {
    return "新会话";
  }

  const normalized = getMessageText(firstUserMessage)
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length === 0) {
    return "新会话";
  }

  return normalized.slice(0, 40);
}

function persistSessionSnapshot(sessionId: string, messages: UIMessage[]): void {
  const updated = sessionsRepository.updateAndGet(sessionId, {
    title: buildSessionTitle(messages),
    messages,
    chatTerminated: false,
  });

  if (!updated) {
    throw new Error("chat session not found when persisting run snapshot");
  }
}

function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.name === "AbortError") {
    return true;
  }
  return /aborted|abort/i.test(error.message);
}

function hasTerminalChunk(bufferedChunks: UIMessageChunk[]): boolean {
  const tail = bufferedChunks[bufferedChunks.length - 1];
  if (!tail) {
    return false;
  }
  return tail.type === "finish" || tail.type === "abort";
}

function broadcastChunk(state: ChatRunState, chunk: UIMessageChunk): void {
  state.bufferedChunks.push(chunk);
  for (const controller of state.subscribers) {
    controller.enqueue(chunk);
  }
}

function emitTerminalChunk(state: ChatRunState, chunk: UIMessageChunk): void {
  if (!hasTerminalChunk(state.bufferedChunks)) {
    broadcastChunk(state, chunk);
  }
}

function closeSubscribers(state: ChatRunState): void {
  if (state.closed) {
    return;
  }

  state.closed = true;
  for (const controller of state.subscribers) {
    controller.close();
  }
  state.subscribers.clear();
}

async function persistCompletedRun(input: {
  runId: string;
  sessionId: string;
  baseMessages: UIMessage[];
  responseMessage: UIMessage;
}): Promise<void> {
  const nextMessages = [...input.baseMessages, input.responseMessage];
  persistSessionSnapshot(input.sessionId, nextMessages);
  runsRepository.markCompleted(input.runId, input.responseMessage);
}

async function executeChatRun(state: ChatRunState, input: StartChatSessionRunInput): Promise<void> {
  runsRepository.markRunning(input.runId);
  state.status = "running";

  let latestAssistantMessage: UIMessage | null = null;

  try {
    // 先把本轮输入（包含用户最新提问）立即落库，避免前端断开时丢失当前回合。
    persistSessionSnapshot(input.sessionId, input.inputMessages);

    const modelMessages = await convertToModelMessages(
      input.inputMessages.map((message) => ({
        role: message.role,
        parts: message.parts,
        metadata: message.metadata,
      })),
    );

    const streamResult = streamText({
      model: input.model,
      system: input.systemPrompt,
      messages: modelMessages,
      tools: input.tools,
      toolChoice: "auto",
      temperature: input.temperature,
      maxOutputTokens: input.maxOutputTokens,
      providerOptions: input.providerOptions,
      stopWhen: stepCountIs(8),
      maxRetries: 0,
      abortSignal: state.controller.signal,
    });

    const uiMessageStream = streamResult.toUIMessageStream({
      originalMessages: input.inputMessages,
    });
    const [broadcastStream, parseStream] = uiMessageStream.tee();

    const parsePromise = (async () => {
      for await (const message of readUIMessageStream<UIMessage>({
        stream: parseStream,
      })) {
        latestAssistantMessage = message;
        // 每次流式增量都持久化当前 assistant 消息快照，保证可恢复。
        persistSessionSnapshot(input.sessionId, [...input.inputMessages, message]);
      }
    })();

    const broadcastReader = broadcastStream.getReader();
    while (true) {
      const { done, value } = await broadcastReader.read();
      if (done) {
        break;
      }
      broadcastChunk(state, value as UIMessageChunk);
    }

    await parsePromise;

    if (state.stopRequested) {
      if (latestAssistantMessage) {
        persistSessionSnapshot(input.sessionId, [...input.inputMessages, latestAssistantMessage]);
      }
      runsRepository.markStopped(input.runId, "run stopped by user");
      state.status = "stopped";
      emitTerminalChunk(state, { type: "abort", reason: "stopped_by_user" });
      return;
    }

    if (!latestAssistantMessage) {
      throw new Error("assistant message missing in run completion");
    }

    await persistCompletedRun({
      runId: input.runId,
      sessionId: input.sessionId,
      baseMessages: input.inputMessages,
      responseMessage: latestAssistantMessage,
    });

    state.status = "completed";
  } catch (error) {
    const message = error instanceof Error ? error.message : "chat run failed";

    if (state.stopRequested || isAbortError(error)) {
      if (latestAssistantMessage) {
        try {
          persistSessionSnapshot(input.sessionId, [...input.inputMessages, latestAssistantMessage]);
        } catch {
          // 忽略停止路径上的补偿持久化失败，不影响终止。
        }
      }
      runsRepository.markStopped(input.runId, message);
      state.status = "stopped";
      emitTerminalChunk(state, { type: "abort", reason: "stopped_by_user" });
      return;
    }

    if (latestAssistantMessage) {
      try {
        persistSessionSnapshot(input.sessionId, [...input.inputMessages, latestAssistantMessage]);
      } catch {
        // 忽略失败路径上的补偿持久化失败，保留原始错误语义。
      }
    }

    runsRepository.markFailed(input.runId, message);
    state.status = "failed";
    emitTerminalChunk(state, { type: "error", errorText: message });
    emitTerminalChunk(state, { type: "finish", finishReason: "error" });
  } finally {
    closeSubscribers(state);

    // 避免内存无限增长：run 结束后保留短时间供重连读取，然后回收。
    setTimeout(() => {
      getRuntime().runs.delete(input.runId);
    }, 30_000);
  }
}

export function hasChatSessionRunInRuntime(runId: string): boolean {
  return getRuntime().runs.has(runId);
}

export function markStaleRunAsFailed(runId: string): void {
  const run = runsRepository.findById(runId);
  if (!run) {
    return;
  }

  if (run.status === "queued" || run.status === "running") {
    runsRepository.markFailed(run.id, "run state unavailable after process restart");
  }
}

export function startChatSessionRun(input: StartChatSessionRunInput): void {
  const runtime = getRuntime();
  if (runtime.runs.has(input.runId)) {
    return;
  }

  const state: ChatRunState = {
    runId: input.runId,
    status: "queued",
    stopRequested: false,
    closed: false,
    controller: new AbortController(),
    bufferedChunks: [],
    subscribers: new Set(),
  };

  runtime.runs.set(input.runId, state);
  void executeChatRun(state, input);
}

export function stopChatSessionRun(runId: string): boolean {
  const state = getRuntime().runs.get(runId);
  if (!state) {
    return false;
  }

  if (state.status === "completed" || state.status === "failed" || state.status === "stopped") {
    return false;
  }

  state.stopRequested = true;
  state.controller.abort("stopped_by_user");
  return true;
}

export function createChatSessionRunStream(runId: string): ReadableStream<UIMessageChunk> {
  const state = getRuntime().runs.get(runId);
  if (!state) {
    return new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({
          type: "error",
          errorText: "chat run is not available in runtime",
        });
        controller.enqueue({
          type: "finish",
          finishReason: "error",
        });
        controller.close();
      },
    });
  }

  let subscriberController: ReadableStreamDefaultController<UIMessageChunk> | null = null;

  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      subscriberController = controller;

      for (const chunk of state.bufferedChunks) {
        controller.enqueue(chunk);
      }

      if (state.closed) {
        controller.close();
        return;
      }

      state.subscribers.add(controller);
    },
    cancel() {
      if (subscriberController) {
        state.subscribers.delete(subscriberController);
      }
    },
  });
}
