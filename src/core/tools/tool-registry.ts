export type ToolExecutionInput = {
  projectId: string;
  toolName: string;
  args: unknown;
};

type ToolHandler = (input: ToolExecutionInput) => Promise<unknown>;

const handlers: Record<string, ToolHandler> = {
  "rag.search": async ({ args }) => ({
    hits: [],
    query: (args as { query?: string })?.query ?? "",
  }),
  "rag.getEvidence": async () => ({ evidence: [] }),
  "timeline.getEntity": async ({ args }) => ({
    entityId: (args as { entityId?: string })?.entityId ?? null,
    timeline: [],
  }),
  "timeline.listEvents": async () => ({ events: [] }),
  "timeline.upsertEvent": async ({ args }) => ({
    upserted: true,
    event: args ?? null,
  }),
  "timeline.editEvent": async ({ args }) => ({
    edited: true,
    event: args ?? null,
  }),
  "lore.upsertNode": async ({ args }) => ({
    upserted: true,
    node: args ?? null,
  }),
  "lore.deleteNode": async ({ args }) => ({
    deleted: true,
    node: args ?? null,
  }),
  "rag.reindex": async ({ args }) => ({
    queued: true,
    request: args ?? null,
  }),
  "settings.providers.rotateKey": async () => ({
    rotated: true,
  }),
  "settings.providers.delete": async () => ({
    deleted: true,
  }),
  "settings.modelPresets.deleteBuiltinLocked": async () => ({
    deleted: true,
  }),
};

export async function executeTool(input: ToolExecutionInput): Promise<unknown> {
  const handler = handlers[input.toolName];
  if (!handler) {
    throw new Error(`unknown tool: ${input.toolName}`);
  }

  return handler(input);
}
