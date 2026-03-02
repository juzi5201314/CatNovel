"use client";

import { FormEvent, useCallback, useMemo, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

type ChatItem = {
  id: string;
  role: ChatRole;
  content: string;
};

type ChatRequestMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatPanelProps = {
  projectId: string | null;
  chapterId: string | null;
};

type SseEventHandler = (event: string, payload: unknown) => void;

async function consumeSse(
  response: Response,
  signal: AbortSignal,
  onEvent: SseEventHandler,
): Promise<void> {
  if (!response.ok || !response.body) {
    throw new Error(`chat request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");

    while (boundary >= 0) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let event = "message";
      const dataLines: string[] = [];

      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
        }
        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }

      const rawData = dataLines.join("\n");
      if (rawData.length > 0) {
        try {
          onEvent(event, JSON.parse(rawData) as unknown);
        } catch {
          // 忽略无法解析的单条事件，保持流不中断。
        }
      }

      boundary = buffer.indexOf("\n\n");
    }
  }
}

function toRequestMessages(messages: ChatItem[]): ChatRequestMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

export function ChatPanel({ projectId, chapterId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<ChatRequestMessage[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canSend = useMemo(
    () => Boolean(projectId) && input.trim().length > 0 && !isStreaming,
    [projectId, input, isStreaming],
  );

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const runStream = useCallback(
    async (requestMessages: ChatRequestMessage[]) => {
      if (!projectId) {
        setError("请先选择项目");
        return;
      }

      const assistantId = crypto.randomUUID();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      setError(null);
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            projectId,
            chapterId: chapterId ?? undefined,
            messages: requestMessages,
            retrieval: { enableGraph: "auto", topK: 8 },
          }),
        });

        await consumeSse(response, controller.signal, (event, payload) => {
          if (event === "token") {
            const text =
              payload && typeof payload === "object" && "text" in payload
                ? String((payload as { text: unknown }).text ?? "")
                : "";
            if (!text) {
              return;
            }

            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + text }
                  : message,
              ),
            );
          }

          if (event === "error") {
            const message =
              payload && typeof payload === "object" && "message" in payload
                ? String((payload as { message: unknown }).message ?? "生成失败")
                : "生成失败";
            setError(message);
          }
        });
      } catch (streamError) {
        if (!controller.signal.aborted) {
          setError(streamError instanceof Error ? streamError.message : "对话请求失败");
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [chapterId, projectId],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const prompt = input.trim();
      if (!prompt || !projectId || isStreaming) {
        return;
      }

      const userMessage: ChatItem = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
      };
      const nextMessages = [...messages, userMessage];
      const requestMessages = toRequestMessages(nextMessages);

      setMessages(nextMessages);
      setInput("");
      setLastRequest(requestMessages);
      await runStream(requestMessages);
    },
    [input, isStreaming, messages, projectId, runStream],
  );

  const handleRetry = useCallback(async () => {
    if (!lastRequest || isStreaming) {
      return;
    }
    await runStream(lastRequest);
  }, [isStreaming, lastRequest, runStream]);

  return (
    <article className="cn-panel">
      <h3 className="cn-card-title">AI 对话</h3>
      <p className="cn-card-description">
        支持流式输出与中断。当前项目：{projectId ?? "未选择"}
      </p>

      <div className="mt-3 max-h-56 overflow-y-auto rounded-md border border-[var(--cn-border)] p-2">
        {messages.length === 0 ? (
          <p className="cn-card-description">发送第一条消息开始对话。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((message) => (
              <li
                key={message.id}
                className="rounded-md border border-[var(--cn-border)] bg-white px-2 py-1"
              >
                <p className="text-xs text-[var(--cn-text-secondary)]">
                  {message.role === "user" ? "你" : "AI"}
                </p>
                <p className="text-sm text-[var(--cn-text-primary)]">{message.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="输入你的问题..."
          rows={3}
          className="rounded-md border border-[var(--cn-border)] p-2 text-sm"
          disabled={!projectId || isStreaming}
        />

        <div className="flex gap-2">
          <button type="submit" disabled={!canSend}>
            发送
          </button>
          <button type="button" onClick={stopStream} disabled={!isStreaming}>
            中断
          </button>
          <button type="button" onClick={() => void handleRetry()} disabled={!lastRequest || isStreaming}>
            重试
          </button>
        </div>
      </form>
    </article>
  );
}
