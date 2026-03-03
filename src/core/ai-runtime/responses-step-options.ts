type StepLike = {
  response?: {
    id?: string;
  };
};

export function resolveResponsesStepProviderOptions(
  apiFormat: "chat_completions" | "responses",
  steps: StepLike[],
): Record<string, Record<string, string>> | undefined {
  void apiFormat;
  void steps;
  // 约束：当前项目接入的网关不支持 previous_response_id。
  // 因此在任何 step 都不允许注入 previousResponseId。
  return undefined;
}
