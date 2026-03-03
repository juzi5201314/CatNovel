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

function asRecord(payload: unknown): Record<string, unknown> | null {
  if (typeof payload === "object" && payload !== null) {
    return payload as Record<string, unknown>;
  }
  return null;
}

function readPayloadText(payload: unknown): string {
  const record = asRecord(payload);
  const text = record?.text;
  return typeof text === "string" ? text : "";
}

function readPayloadMessage(payload: unknown, fallback: string): string {
  const record = asRecord(payload);
  const message = record?.message;
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }
  return fallback;
}

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
            const text = readPayloadText(payload);
            if (!text) return;

            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + text } : m))
            );
            
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }

          if (event === "error") {
            setError(readPayloadMessage(payload, "Generation failed"));
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

  const submitPrompt = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || !projectId || isStreaming) {
      return;
    }

    const userMessage: ChatItem = { id: crypto.randomUUID(), role: "user", content: prompt };
    const nextMessages = [...messages, userMessage];
    const requestMessages = toRequestMessages(nextMessages);

    setMessages(nextMessages);
    setInput("");
    setLastRequest(requestMessages);
    await runStream(requestMessages);
  }, [input, isStreaming, messages, projectId, runStream]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      await submitPrompt();
    },
    [submitPrompt],
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Chat</h3>
        {isStreaming && (
          <button className="text-[10px] px-2 py-0.5 text-red-600 hover:bg-red-50 transition-colors font-bold uppercase tracking-tighter" onClick={stopStream}>
            Stop
          </button>
        )}
      </div>

      <div 
        ref={scrollRef}
        className="space-y-6 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar py-2"
      >
        {messages.length === 0 ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto opacity-20">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <p className="text-xs text-muted-foreground font-medium px-8 leading-relaxed">Ask anything about your story, characters, or plot consistency.</p>
            <div className="flex flex-wrap justify-center gap-2 px-4">
              {["Outline this chapter", "Check character arc", "Twist suggestions"].map(s => (
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
          messages.map((m) => (
            <div key={m.id} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-1 duration-300 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black border shadow-sm ${
                m.role === 'user' ? 'bg-background border-border text-foreground' : 'bg-foreground border-foreground text-background'
              }`}>
                {m.role === 'user' ? 'U' : 'AI'}
              </div>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm border transition-all ${
                m.role === 'user' 
                  ? 'bg-foreground text-background rounded-tr-none border-foreground' 
                  : 'bg-muted/50 text-foreground rounded-tl-none border-border'
              }`}>
                <div className="whitespace-pre-wrap">
                  {m.content || (isStreaming && m.role === 'assistant' ? <span className="animate-pulse">Thinking...</span> : null)}
                </div>
              </div>
            </div>
          ))
        )}
        {error && (
          <div className="text-[10px] font-bold text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="relative group">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (canSend) {
                void submitPrompt();
              }
            }
          }}
          placeholder="Message AI Assistant..."
          rows={3}
          className="w-full pr-12 resize-none bg-muted/20 focus:bg-background transition-all rounded-2xl border border-border p-4 outline-none focus:ring-4 ring-accent/5 text-sm leading-relaxed"
          disabled={!projectId || isStreaming}
        />
        <div className="absolute right-3 bottom-3 flex items-center gap-3">
          <kbd className="hidden md:inline-flex opacity-0 group-focus-within:opacity-30 transition-opacity bg-transparent border-none shadow-none text-[9px] font-black">ENTER</kbd>
          <button 
            type="submit" 
            disabled={!canSend}
            className="p-2 rounded-xl primary disabled:opacity-20 transition-all shadow-xl shadow-black/10 hover:shadow-accent/20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 7-7 7 7M12 19V5"/></svg>
          </button>
        </div>
      </form>
    </section>
  );
}
