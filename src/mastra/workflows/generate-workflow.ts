import type { ChatApiFormat } from "@/mastra/agents/chat-agent";

export type GenerateTaskType = "continue" | "rewrite" | "polish" | "expand";

export type GenerateStreamInput = {
  taskType: GenerateTaskType;
  prompt: string;
  selection?: string;
  chatPresetId?: string;
  override?: {
    apiFormat?: ChatApiFormat;
    baseURL?: string;
    modelId?: string;
    thinkingBudget?: unknown;
  };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function splitTextForStream(text: string): string[] {
  return text.split(/(\s+)/).filter((part) => part.length > 0);
}

function buildGenerateText(input: GenerateStreamInput): string {
  const mode = input.override?.apiFormat ?? "chat_completions";
  const target = input.selection?.slice(0, 80) ?? "当前章节";
  const base = input.prompt.slice(0, 160);

  const header = `任务=${input.taskType}，format=${mode}。`;

  switch (input.taskType) {
    case "continue":
      return `${header} 我将围绕 ${target} 继续推进剧情：${base}`;
    case "rewrite":
      return `${header} 我将重写 ${target} 的表达与节奏：${base}`;
    case "polish":
      return `${header} 我将润色 ${target} 的语言细节：${base}`;
    case "expand":
      return `${header} 我将扩写 ${target} 并补充感官描写：${base}`;
    default:
      return `${header} ${base}`;
  }
}

export async function* streamGenerateTokens(
  input: GenerateStreamInput,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const text = buildGenerateText(input);
  for (const token of splitTextForStream(text)) {
    if (signal.aborted) {
      return;
    }
    yield token;
    await sleep(20);
  }
}
