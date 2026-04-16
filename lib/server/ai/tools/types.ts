import type { Tool, ToolCall } from '@mariozechner/pi-ai';
import type { TSchema } from '@sinclair/typebox';

export type ToolParameterSchema = TSchema;

export type ToolHandler<TArgs = unknown, TResult = unknown> = (args: TArgs) => Promise<TResult>;

export interface ToolDefinition extends Tool<ToolParameterSchema> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: ToolHandler<any, any>;
}

export type AnyToolDefinition = ToolDefinition;

export type ValidatedToolCall = {
  tool: AnyToolDefinition;
  args: unknown;
  toolCall: ToolCall;
};
