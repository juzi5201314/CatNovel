import { desc, eq } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import { toolExecutionLogs, type ToolExecutionStatus } from "@/db/schema";

import { BaseRepository } from "./base-repository";

export type ToolExecutionLogInput = {
  id?: string;
  approvalId?: string | null;
  toolName: string;
  inputPayload: unknown;
  outputPayload?: unknown;
  execStatus: ToolExecutionStatus;
};

export class ToolExecutionLogsRepository extends BaseRepository {
  constructor(database?: AppDatabase) {
    super(database);
  }

  create(input: ToolExecutionLogInput) {
    const id = input.id ?? crypto.randomUUID();
    this.db
      .insert(toolExecutionLogs)
      .values({
        id,
        approvalId: input.approvalId ?? null,
        toolName: input.toolName,
        inputPayload: JSON.stringify(input.inputPayload),
        outputPayload:
          input.outputPayload === undefined
            ? null
            : JSON.stringify(input.outputPayload),
        execStatus: input.execStatus,
      })
      .run();

    return this.db
      .select()
      .from(toolExecutionLogs)
      .where(eq(toolExecutionLogs.id, id))
      .get();
  }

  listByApprovalId(approvalId: string) {
    return this.db
      .select()
      .from(toolExecutionLogs)
      .where(eq(toolExecutionLogs.approvalId, approvalId))
      .orderBy(desc(toolExecutionLogs.createdAt))
      .all();
  }
}
