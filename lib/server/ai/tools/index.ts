import {
  validateToolCall as validatePiToolCall,
  type ToolCall,
} from '@mariozechner/pi-ai';

import { applySuggestionTool } from './apply-suggestion.ts';
import { readChapterTool } from './read-chapter.ts';
import { searchCharactersTool } from './search-characters.ts';
import type { AnyToolDefinition, ToolDefinition, ValidatedToolCall } from './types.ts';

export { ApplySuggestionSchema, applySuggestionTool } from './apply-suggestion.ts';
export { ReadChapterSchema, readChapterTool } from './read-chapter.ts';
export { SearchCharactersSchema, searchCharactersTool } from './search-characters.ts';
export type {
  AnyToolDefinition,
  ToolDefinition,
  ToolHandler,
  ToolParameterSchema,
  ValidatedToolCall,
} from './types.ts';

export const tools: ToolDefinition[] = [
  readChapterTool,
  searchCharactersTool,
  applySuggestionTool,
];

export class ToolRegistry {
  private readonly toolMap = new Map<string, AnyToolDefinition>();

  constructor(definitions: readonly ToolDefinition[] = []) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  register(definition: ToolDefinition) {
    if (this.toolMap.has(definition.name)) {
      throw new Error(`Duplicate tool definition: ${definition.name}`);
    }

    this.toolMap.set(definition.name, definition);
    return this;
  }

  get(name: string) {
    return this.toolMap.get(name);
  }

  list() {
    return [...this.toolMap.values()];
  }

  validate(toolCall: ToolCall): ValidatedToolCall {
    const tool = this.get(toolCall.name);

    if (!tool) {
      throw new Error(`Unknown tool: ${toolCall.name}`);
    }

    const args = validatePiToolCall(this.list(), toolCall);
    return { tool, args, toolCall };
  }

  async execute(toolCall: ToolCall) {
    const validated = this.validate(toolCall);
    return validated.tool.handler(validated.args as never);
  }
}

export const toolRegistry = new ToolRegistry(tools);

export function validateToolCall(toolCall: ToolCall): ValidatedToolCall;
export function validateToolCall(
  definitions: readonly ToolDefinition[],
  toolCall: ToolCall,
): ValidatedToolCall;
export function validateToolCall(
  definitionsOrToolCall: readonly ToolDefinition[] | ToolCall,
  maybeToolCall?: ToolCall,
): ValidatedToolCall {
  if (Array.isArray(definitionsOrToolCall)) {
    if (!maybeToolCall) {
      throw new Error('Tool call is required when validating against explicit definitions.');
    }

    return new ToolRegistry(definitionsOrToolCall).validate(maybeToolCall);
  }

  return toolRegistry.validate(definitionsOrToolCall as ToolCall);
}
