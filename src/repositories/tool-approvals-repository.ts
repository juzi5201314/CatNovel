import { and, desc, eq } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import {
  toolApprovalRequests,
  type ToolApprovalStatus,
  type ToolRiskLevel,
} from "@/db/schema";

import { assertToolApprovalTransition } from "@/core/tools/tool-approval-state-machine";

import { BaseRepository } from "./base-repository";

export type CreateToolApprovalRequestInput = {
  id?: string;
  projectId: string;
  toolName: string;
  riskLevel: ToolRiskLevel;
  requestPayload: unknown;
  reason?: string;
  expiresAt?: Date | string;
};

export type ToolApprovalTransitionInput = {
  approvalId: string;
  toStatus: ToolApprovalStatus;
  reason?: string;
};

export class ToolApprovalsRepository extends BaseRepository {
  constructor(database?: AppDatabase) {
    super(database);
  }

  create(input: CreateToolApprovalRequestInput) {
    const id = input.id ?? crypto.randomUUID();
    this.db
      .insert(toolApprovalRequests)
      .values({
        id,
        projectId: input.projectId,
        toolName: input.toolName,
        riskLevel: input.riskLevel,
        requestPayload: JSON.stringify(input.requestPayload),
        status: "pending",
        reason: input.reason ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      })
      .run();

    return this.getById(id);
  }

  getById(id: string) {
    const row = this.db
      .select()
      .from(toolApprovalRequests)
      .where(eq(toolApprovalRequests.id, id))
      .get();
    return row ?? null;
  }

  listByProject(projectId: string, status?: ToolApprovalStatus) {
    if (status) {
      return this.db
        .select()
        .from(toolApprovalRequests)
        .where(
          and(
            eq(toolApprovalRequests.projectId, projectId),
            eq(toolApprovalRequests.status, status),
          ),
        )
        .orderBy(desc(toolApprovalRequests.requestedAt))
        .all();
    }

    return this.db
      .select()
      .from(toolApprovalRequests)
      .where(eq(toolApprovalRequests.projectId, projectId))
      .orderBy(desc(toolApprovalRequests.requestedAt))
      .all();
  }

  transition(input: ToolApprovalTransitionInput): boolean {
    const existing = this.getById(input.approvalId);
    if (!existing) {
      return false;
    }

    assertToolApprovalTransition(existing.status, input.toStatus);

    const patch: Partial<typeof toolApprovalRequests.$inferInsert> = {
      status: input.toStatus,
      reason: input.reason ?? existing.reason,
    };

    if (input.toStatus === "approved") {
      patch.approvedAt = new Date();
    }
    if (input.toStatus === "executed") {
      patch.executedAt = new Date();
    }

    const result = this.db
      .update(toolApprovalRequests)
      .set(patch)
      .where(eq(toolApprovalRequests.id, input.approvalId))
      .run();

    return result.changes > 0;
  }
}
