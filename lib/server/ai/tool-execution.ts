import type { AgentTool } from '@mariozechner/pi-agent-core';
import type { TextContent } from '@mariozechner/pi-ai';

import type { ToolDefinition } from './tools/types.ts';

export interface ToolExecutionConfig {
  beforeToolCall?: (
    toolName: string,
    args: unknown,
  ) =>
    | { block: boolean; reason?: string }
    | Promise<{ block: boolean; reason?: string } | undefined>
    | undefined;
  afterToolCall?: (
    toolName: string,
    result: unknown,
    isError: boolean,
  ) => unknown | Promise<unknown>;
  timeoutMs?: number;
}

export interface FormattedToolResult {
  content: TextContent[];
  details: unknown;
}

export interface ToolExecutionResult {
  result: FormattedToolResult;
  isError: boolean;
  executionTimeMs: number;
}

export interface WrappedToolExecutionDetails {
  __catNovelToolExecution: true;
  result: unknown;
  isError: boolean;
  executionTimeMs: number;
}

export async function executeToolWithSafety(
  tool: ToolDefinition,
  args: unknown,
  config: ToolExecutionConfig = {},
  abortSignal?: AbortSignal,
): Promise<ToolExecutionResult> {
  const startedAt = Date.now();

  let currentResult: unknown;
  let isError = false;

  try {
    const beforeDecision = await config.beforeToolCall?.(tool.name, args);
    if (beforeDecision?.block) {
      currentResult = beforeDecision.reason?.trim() || `Tool "${tool.name}" was blocked.`;
      isError = true;
    } else {
      const combinedSignal = createCombinedAbortSignal(tool.name, config.timeoutMs, abortSignal);

      try {
        currentResult = await raceWithSignal(
          Promise.resolve(tool.handler(args as never)),
          combinedSignal.signal,
          tool.name,
          config.timeoutMs,
        );
      } finally {
        combinedSignal.dispose();
      }
    }
  } catch (error) {
    currentResult = normalizeErrorMessage(tool.name, error, config.timeoutMs);
    isError = true;
  }

  try {
    const transformedResult = await config.afterToolCall?.(tool.name, currentResult, isError);
    if (transformedResult !== undefined) {
      currentResult = transformedResult;
    }
  } catch (error) {
    currentResult = normalizeErrorMessage(tool.name, error, config.timeoutMs);
    isError = true;
  }

  return {
    result: formatToolResult(currentResult),
    isError,
    executionTimeMs: Date.now() - startedAt,
  };
}

export function createAgentTool(
  tool: ToolDefinition,
  config: ToolExecutionConfig = {},
): AgentTool<ToolDefinition['parameters'], WrappedToolExecutionDetails> {
  return {
    name: tool.name,
    label: humanizeToolName(tool.name),
    description: tool.description,
    parameters: tool.parameters,
    execute: async (_toolCallId, params, signal) => {
      const execution = await executeToolWithSafety(tool, params, config, signal);

      return {
        content: execution.result.content,
        details: wrapToolExecutionDetails(execution),
      };
    },
  };
}

export function createAgentTools(
  tools: readonly ToolDefinition[],
  config: ToolExecutionConfig = {},
): AgentTool[] {
  return tools.map((tool) => createAgentTool(tool, config));
}

export function isWrappedToolExecutionDetails(
  value: unknown,
): value is WrappedToolExecutionDetails {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__catNovelToolExecution' in value &&
    (value as WrappedToolExecutionDetails).__catNovelToolExecution === true
  );
}

function wrapToolExecutionDetails(
  execution: ToolExecutionResult,
): WrappedToolExecutionDetails {
  return {
    __catNovelToolExecution: true,
    result: execution.result.details,
    isError: execution.isError,
    executionTimeMs: execution.executionTimeMs,
  };
}

function formatToolResult(value: unknown): FormattedToolResult {
  return {
    content: [{ type: 'text', text: stringifyToolResult(value) }],
    details: value,
  };
}

function stringifyToolResult(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  if (value === null || value === undefined) {
    return 'null';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeErrorMessage(
  toolName: string,
  error: unknown,
  timeoutMs?: number,
): string {
  if (error instanceof ToolExecutionTimeoutError) {
    return `Tool "${toolName}" timed out after ${error.timeoutMs}ms.`;
  }

  if (error instanceof ToolExecutionAbortError) {
    return `Tool "${toolName}" was aborted.`;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return timeoutMs
      ? `Tool "${toolName}" timed out after ${timeoutMs}ms.`
      : `Tool "${toolName}" was aborted.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return `Tool "${toolName}" failed.`;
}

function humanizeToolName(toolName: string): string {
  return toolName
    .split('_')
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(' ');
}

function createCombinedAbortSignal(
  toolName: string,
  timeoutMs?: number,
  abortSignal?: AbortSignal,
) {
  const controller = new AbortController();
  const onAbort = () => {
    controller.abort(new ToolExecutionAbortError(toolName));
  };

  if (abortSignal?.aborted) {
    controller.abort(new ToolExecutionAbortError(toolName));
  } else if (abortSignal) {
    abortSignal.addEventListener('abort', onAbort, { once: true });
  }

  const timeoutId =
    timeoutMs !== undefined
      ? setTimeout(() => {
          controller.abort(new ToolExecutionTimeoutError(toolName, timeoutMs));
        }, timeoutMs)
      : undefined;

  return {
    signal: controller.signal,
    dispose() {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      if (abortSignal) {
        abortSignal.removeEventListener('abort', onAbort);
      }
    },
  };
}

async function raceWithSignal<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  toolName: string,
  timeoutMs?: number,
): Promise<T> {
  if (signal.aborted) {
    throw signal.reason ?? new ToolExecutionAbortError(toolName);
  }

  let onAbort: (() => void) | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        onAbort = () => {
          reject(signal.reason ?? createAbortReason(toolName, timeoutMs));
        };

        signal.addEventListener('abort', onAbort, { once: true });
      }),
    ]);
  } finally {
    if (onAbort) {
      signal.removeEventListener('abort', onAbort);
    }
  }
}

function createAbortReason(toolName: string, timeoutMs?: number) {
  if (timeoutMs !== undefined) {
    return new ToolExecutionTimeoutError(toolName, timeoutMs);
  }

  return new ToolExecutionAbortError(toolName);
}

class ToolExecutionTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(
    toolName: string,
    timeoutMs: number,
  ) {
    super(`Tool "${toolName}" timed out after ${timeoutMs}ms.`);
    this.name = 'ToolExecutionTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

class ToolExecutionAbortError extends Error {
  constructor(toolName: string) {
    super(`Tool "${toolName}" was aborted.`);
    this.name = 'ToolExecutionAbortError';
  }
}
