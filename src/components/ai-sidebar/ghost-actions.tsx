"use client";

import { useCallback, useRef, useState } from "react";

import type { ChapterItem } from "@/components/workspace/types";

type GhostActionsProps = {
  projectId: string | null;
  chapter: ChapterItem | null;
  onAcceptGhost: (ghostText: string) => Promise<void>;
};

type SseEventHandler = (event: string, payload: unknown) => void;

async function consumeSse(
  response: Response,
  signal: AbortSignal,
  onEvent: SseEventHandler,
): Promise<void> {
  if (!response.ok || !response.body) {
    throw new Error(`generate request failed: ${response.status}`);
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
          // 忽略单条解析失败事件。
        }
      }

      boundary = buffer.indexOf("\n\n");
    }
  }
}

export function GhostActions({
  projectId,
  chapter,
  onAcceptGhost,
}: GhostActionsProps) {
  const [ghostText, setGhostText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const generateGhost = useCallback(async () => {
    if (!projectId || !chapter) {
      setError("请先选择项目与章节");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setGhostText("");
    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          projectId,
          chapterId: chapter.id,
          taskType: "continue",
          prompt: "请根据当前章节续写，保持叙事风格与人物一致。",
          selection: chapter.content,
        }),
      });

      await consumeSse(response, controller.signal, (event, payload) => {
        if (event === "token") {
          const text =
            payload && typeof payload === "object" && "text" in payload
              ? String((payload as { text: unknown }).text ?? "")
              : "";
          if (text) {
            setGhostText((prev) => prev + text);
          }
        }

        if (event === "error") {
          const message =
            payload && typeof payload === "object" && "message" in payload
              ? String((payload as { message: unknown }).message ?? "生成失败")
              : "生成失败";
          setError(message);
        }
      });
    } catch (generateError) {
      if (!controller.signal.aborted) {
        setError(generateError instanceof Error ? generateError.message : "Ghost 生成失败");
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [chapter, projectId]);

  const stopGenerate = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
  }, []);

  const acceptGhost = useCallback(async () => {
    if (!ghostText.trim()) {
      return;
    }

    setIsApplying(true);
    setError(null);
    try {
      await onAcceptGhost(ghostText);
      setGhostText("");
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "回填失败");
    } finally {
      setIsApplying(false);
    }
  }, [ghostText, onAcceptGhost]);

  return (
    <article className="cn-panel">
      <h3 className="cn-card-title">Ghost Text</h3>
      <p className="cn-card-description">续写候选可接受/拒绝/重生成。</p>

      <div className="mt-2 rounded-md border border-dashed border-[var(--cn-border)] p-2">
        {ghostText ? (
          <p className="text-sm text-[var(--cn-text-primary)] whitespace-pre-wrap">{ghostText}</p>
        ) : (
          <p className="cn-card-description">暂无候选文本</p>
        )}
      </div>

      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void generateGhost()} disabled={isGenerating || !chapter}>
          {ghostText ? "重生成" : "生成"}
        </button>
        <button type="button" onClick={stopGenerate} disabled={!isGenerating}>
          中断
        </button>
        <button
          type="button"
          onClick={() => void acceptGhost()}
          disabled={!ghostText.trim() || isApplying}
        >
          接受
        </button>
        <button type="button" onClick={() => setGhostText("")} disabled={!ghostText.trim()}>
          拒绝
        </button>
      </div>
    </article>
  );
}
