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
    throw new Error(`Chat request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) break;

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
          // Ignore parse errors
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}

function toRequestMessages(messages: ChatItem[]): ChatRequestMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export function ChatPanel({ projectId, chapterId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<ChatRequestMessage[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
        setError("Please select a project first.");
        return;
      }

      const assistantId = crypto.randomUUID();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      setError(null);
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

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
            const text = (payload as any)?.text ?? "";
            if (!text) return;

            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + text } : m))
            );
            
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }

          if (event === "error") {
            setError((payload as any)?.message ?? "Generation failed");
          }
        });
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Chat request failed");
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [chapterId, projectId],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const prompt = input.trim();
      if (!prompt || !projectId || isStreaming) return;

      const userMessage: ChatItem = { id: crypto.randomUUID(), role: "user", content: prompt };
      const nextMessages = [...messages, userMessage];
      const requestMessages = toRequestMessages(nextMessages);

      setMessages(nextMessages);
      setInput("");
      setLastRequest(requestMessages);
      await runStream(requestMessages);
    },
    [input, isStreaming, messages, projectId, runStream],
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Chat</h3>
        {isStreaming && (
          <button className="text-[10px] px-2 py-0.5 text-red-600 hover:bg-red-50 transition-colors" onClick={stopStream}>
            Stop
          </button>
        )}
      </div>

      <div 
        ref={scrollRef}
        className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar"
      >
        {messages.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-sm text-muted-foreground">Ask anything about your project.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {["Outline this chapter", "Character consistency check", "Suggest some twists"].map(s => (
                <button 
                  key={s} 
                  className="text-[10px] px-2 py-1 bg-muted hover:bg-muted-foreground/10 rounded-full transition-colors"
                  onClick={() => setInput(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm ${
                m.role === 'user' 
                  ? 'bg-foreground text-background rounded-tr-none' 
                  : 'bg-muted text-foreground rounded-tl-none border border-border'
              }`}>
                {m.content || (isStreaming && m.role === 'assistant' ? <span className="animate-pulse">...</span> : null)}
              </div>
            </div>
          ))
        )}
        {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded-md border border-red-100">{error}</p>}
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (canSend) handleSubmit(e as any);
            }
          }}
          placeholder="Message AI Assistant..."
          rows={2}
          className="w-full pr-12 resize-none bg-muted/30 focus:bg-background transition-colors"
          disabled={!projectId || isStreaming}
        />
        <button 
          type="submit" 
          disabled={!canSend}
          className="absolute right-2 bottom-2 p-1.5 rounded-md primary disabled:opacity-30 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12 7-7 7 7M12 19V5"/></svg>
        </button>
      </form>
    </section>
  );
}
