import { Type, type Static } from '@sinclair/typebox';

import type { ToolDefinition, ToolHandler } from './types.ts';

const pendingUserInputs = new Map<string, {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
  question: string;
  options?: string[];
  multiselect?: boolean;
  context?: string;
  timeoutId: ReturnType<typeof setTimeout>;
}>();

let notifyFrontendCallback: ((data: {
  toolCallId: string;
  question: string;
  options?: string[];
  multiselect?: boolean;
  context?: string;
}) => void) | null = null;

export function setAskUserNotificationCallback(
  callback: typeof notifyFrontendCallback,
): void {
  notifyFrontendCallback = callback;
}

/**
 * 检查是否有指定ID的挂起请求
 */
export function hasPendingAskUser(toolCallId: string): boolean {
  return pendingUserInputs.has(toolCallId);
}

/**
 * 获取所有挂起的 ask_user 请求（用于显示列表）
 */
export function getPendingAskUsers(): Array<{
  toolCallId: string;
  question: string;
  options?: string[];
  context?: string;
}> {
  return Array.from(pendingUserInputs.entries()).map(([toolCallId, data]) => ({
    toolCallId,
    question: data.question,
    options: data.options,
    context: data.context,
  }));
}

/**
 * 提交用户回复，解除挂起的工具
 * @returns 是否成功找到并解除了挂起的请求
 */
export function submitUserResponse(toolCallId: string, response: string): boolean {
  const pending = pendingUserInputs.get(toolCallId);

  if (!pending) {
    return false;
  }

  // 清除超时
  clearTimeout(pending.timeoutId);

  // 解除挂起，返回用户输入
  pending.resolve(response);

  // 从等待池中移除
  pendingUserInputs.delete(toolCallId);

  return true;
}

/**
 * 取消挂起的 ask_user（超时或用户主动取消）
 */
export function cancelAskUser(toolCallId: string, reason: string): boolean {
  const pending = pendingUserInputs.get(toolCallId);

  if (!pending) {
    return false;
  }

  // 清除超时
  clearTimeout(pending.timeoutId);

  // 拒绝 Promise，使工具返回错误
  pending.reject(new Error(`Ask user cancelled: ${reason}`));

  // 从等待池中移除
  pendingUserInputs.delete(toolCallId);

  return true;
}

/**
 * 清除所有挂起的 ask_user（会话结束或重置时使用）
 */
export function clearAllPendingAskUsers(): void {
  for (const [, pending] of pendingUserInputs) {
    clearTimeout(pending.timeoutId);
    pending.reject(new Error('Session ended before user could respond'));
  }

  pendingUserInputs.clear();
}

export const AskUserSchema = Type.Object({
  question: Type.String({
    minLength: 1,
    description: 'The question to ask the user. Be specific and clear about what information you need.',
  }),
  options: Type.Optional(
    Type.Array(Type.String(), {
      description: 'Optional predefined options for the user to choose from.',
    }),
  ),
  multiselect: Type.Optional(
    Type.Boolean({
      description: 'If true, allow selecting multiple options. Only applies when options are provided.',
    }),
  ),
  context: Type.Optional(
    Type.String({
      description: 'Optional context explaining why this question is being asked and how the answer will be used.',
    }),
  ),
}, {
  description: 'Ask the user a question and wait for their response. The agent will pause until the user provides an answer.',
});

export type AskUserParams = Static<typeof AskUserSchema>;

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

const askUserHandler: ToolHandler<AskUserParams> = async ({ question, options, multiselect, context }) => {
  const toolCallId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    // 设置超时
    const timeoutId = setTimeout(() => {
      if (pendingUserInputs.has(toolCallId)) {
        pendingUserInputs.delete(toolCallId);
        reject(new Error('User did not respond within 5 minutes'));
      }
    }, DEFAULT_TIMEOUT_MS);

    // 存储挂起状态
    pendingUserInputs.set(toolCallId, {
      resolve,
      reject,
      question,
      options,
      multiselect,
      context,
      timeoutId,
    });

    if (notifyFrontendCallback) {
      notifyFrontendCallback({
        toolCallId,
        question,
        options,
        multiselect,
        context,
      });
    }
  });
};

export const askUserTool: ToolDefinition = {
  name: 'ask_user',
  description: `Ask the user a question and wait for their response. 

Use this tool when:
- You need clarification before proceeding with a task
- You need to confirm an action (especially destructive ones)
- You need additional information to complete the current task
- You want to present options for the user to choose from

The agent will PAUSE execution until the user responds. This is a blocking operation.

Examples:
- "Should I apply this change to Chapter 1 or Chapter 2?"
- "Please confirm: delete the character 'John Smith'?"
- "What genre should this story be? Options: Romance, Sci-Fi, Mystery, Fantasy"`,
  parameters: AskUserSchema,
  handler: askUserHandler,
};
