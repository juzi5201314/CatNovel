import {
  streamTextFromProvider,
  type ChatApiFormat,
  type ChatMessage,
  type ChatOverride,
} from "@/core/llm";

export type { ChatApiFormat, ChatMessage };

export type ChatStreamInput = {
  projectId: string;
  messages: ChatMessage[];
  chatPresetId?: string;
  override?: ChatOverride;
};

export async function* streamChatTokens(
  input: ChatStreamInput,
  signal: AbortSignal,
): AsyncGenerator<string> {
  yield* streamTextFromProvider({
    requestTag: "chat",
    projectId: input.projectId,
    messages: input.messages,
    chatPresetId: input.chatPresetId,
    override: input.override,
    signal,
  });
}
