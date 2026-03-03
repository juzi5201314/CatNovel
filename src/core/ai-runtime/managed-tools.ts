import { jsonSchema, tool, type JSONSchema7, type ToolSet } from "ai";

import {
  executeManagedTool,
  isToolExecutionServiceError,
} from "@/core/tools/tool-execution-service";
import { listToolCatalog, toToolAlias } from "@/core/tools/tool-catalog";

export type ManagedToolContext = {
  projectId: string;
  chapterId?: string;
};

export type ManagedToolFailedResult = {
  status: "failed";
  error: string;
  code?: string;
  details?: unknown;
};

type ManagedToolExecutionResult =
  | Awaited<ReturnType<typeof executeManagedTool>>
  | ManagedToolFailedResult;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeToolArgs(
  toolName: string,
  rawArgs: unknown,
  chapterId?: string,
): Record<string, unknown> {
  const input = asRecord(rawArgs) ?? {};
  const args: Record<string, unknown> = { ...input };
  delete args.__toolMetadata;

  if (
    chapterId &&
    (toolName.startsWith("chapter.") || toolName.startsWith("timeline.")) &&
    args.chapterId === undefined
  ) {
    args.chapterId = chapterId;
  }

  return args;
}

async function executeManagedToolSafe(
  context: ManagedToolContext,
  toolName: string,
  rawArgs: unknown,
): Promise<ManagedToolExecutionResult> {
  const args = normalizeToolArgs(toolName, rawArgs, context.chapterId);

  try {
    return await executeManagedTool({
      projectId: context.projectId,
      toolName,
      args,
    });
  } catch (error) {
    if (isToolExecutionServiceError(error)) {
      return {
        status: "failed",
        error: error.message,
        code: error.code,
        details: error.details,
      };
    }

    return {
      status: "failed",
      error: error instanceof Error ? error.message : "unknown tool execution error",
    };
  }
}

export type ManagedToolsBundle = {
  tools: ToolSet;
  aliasToToolName: Map<string, string>;
  toolNameToAlias: Map<string, string>;
};

export function buildManagedTools(context: ManagedToolContext): ManagedToolsBundle {
  const tools: ToolSet = {};
  const aliasToToolName = new Map<string, string>();
  const toolNameToAlias = new Map<string, string>();

  for (const item of listToolCatalog()) {
    const alias = toToolAlias(item.toolName);
    aliasToToolName.set(alias, item.toolName);
    toolNameToAlias.set(item.toolName, alias);

    tools[alias] = tool({
      description: [
        item.description,
        `Internal tool name: ${item.toolName}.`,
        `Risk level: ${item.riskLevel}.`,
      ].join(" "),
      inputSchema: jsonSchema(item.parameters as unknown as JSONSchema7),
      execute: async (rawArgs: unknown) =>
        executeManagedToolSafe(context, item.toolName, rawArgs),
    }) as ToolSet[string];
  }

  return {
    tools,
    aliasToToolName,
    toolNameToAlias,
  };
}
