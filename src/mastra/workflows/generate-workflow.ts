import {
  streamTextFromProvider,
  type ChatMessage,
  type ChatOverride,
} from "@/core/llm";
import { resolveProjectSystemPrompt } from "@/core/llm/project-system-prompt";

export type GenerateTaskType = "continue" | "rewrite" | "polish" | "expand";

export type GenerateStreamInput = {
  projectId: string;
  taskType: GenerateTaskType;
  prompt: string;
  selection?: string;
  chatPresetId?: string;
  override?: ChatOverride;
};

function taskInstruction(taskType: GenerateTaskType): string {
  switch (taskType) {
    case "continue":
      return "基于上下文继续写作，推进剧情并保持节奏连贯。";
    case "rewrite":
      return "在不改变核心信息的前提下重写文本，优化叙述结构与表达。";
    case "polish":
      return "润色语言细节，提升可读性与情绪感染力。";
    case "expand":
      return "在原意基础上扩写内容，补足细节与感官描写。";
    default:
      return "按要求完成写作任务。";
  }
}

function buildGenerateMessages(
  input: GenerateStreamInput,
  systemPrompt: string,
): ChatMessage[] {
  const selection = input.selection?.trim();
  const userPromptParts = [
    `任务类型：${input.taskType}`,
    `任务说明：${taskInstruction(input.taskType)}`,
    selection ? `选中文本：\n${selection}` : "选中文本：无（基于章节上下文执行）",
    `补充要求：${input.prompt.trim()}`,
    "输出要求：直接输出最终文本，不要解释思路。",
  ];

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPromptParts.join("\n\n"),
    },
  ];
}

export async function* streamGenerateTokens(
  input: GenerateStreamInput,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const systemPrompt = resolveProjectSystemPrompt(input.projectId);
  const messages = buildGenerateMessages(input, systemPrompt);
  yield* streamTextFromProvider({
    requestTag: "generate",
    projectId: input.projectId,
    messages,
    chatPresetId: input.chatPresetId,
    override: input.override,
    signal,
  });
}
