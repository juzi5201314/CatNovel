export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatApiFormat = "chat_completions" | "responses";

export type ChatStreamInput = {
  messages: ChatMessage[];
  chatPresetId?: string;
  override?: {
    apiFormat?: ChatApiFormat;
    baseURL?: string;
    modelId?: string;
    thinkingBudget?: unknown;
  };
};

function splitTextForStream(text: string): string[] {
  return text
    .split(/(\s+)/)
    .map((part) => part.trim() === "" ? part : part)
    .filter((part) => part.length > 0);
}

function buildAnswer(input: ChatStreamInput): string {
  const lastUser = [...input.messages].reverse().find((item) => item.role === "user");
  const userPrompt = lastUser?.content ?? "";
  const apiFormat = input.override?.apiFormat ?? "chat_completions";
  const modelId = input.override?.modelId ?? "default-model";
  const prefix = `已收到请求（format=${apiFormat}, model=${modelId}）。`;

  if (userPrompt.length === 0) {
    return `${prefix} 请提供更具体的写作问题。`;
  }

  return `${prefix} 结合当前上下文，建议先明确人物目标，再推进冲突：${userPrompt.slice(0, 160)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function* streamChatTokens(
  input: ChatStreamInput,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const text = buildAnswer(input);
  for (const token of splitTextForStream(text)) {
    if (signal.aborted) {
      return;
    }
    yield token;
    await sleep(20);
  }
}
