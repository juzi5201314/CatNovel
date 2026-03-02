import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import { toolPolicies, type ToolRiskLevel } from "@/db/schema";

import { BaseRepository } from "./base-repository";

export type ToolPolicyRecord = {
  toolName: string;
  riskLevel: ToolRiskLevel;
  requiresConfirmation?: boolean;
  enabled?: boolean;
};

export class ToolPoliciesRepository extends BaseRepository {
  constructor(database?: AppDatabase) {
    super(database);
  }

  list() {
    return this.db.select().from(toolPolicies).orderBy(toolPolicies.toolName).all();
  }

  findByToolName(toolName: string) {
    const row = this.db
      .select()
      .from(toolPolicies)
      .where(eq(toolPolicies.toolName, toolName))
      .get();
    return row ?? null;
  }

  upsert(record: ToolPolicyRecord): ToolPolicyRecord {
    this.db
      .insert(toolPolicies)
      .values({
        toolName: record.toolName,
        riskLevel: record.riskLevel,
        requiresConfirmation: record.requiresConfirmation ?? true,
        enabled: record.enabled ?? true,
      })
      .onConflictDoUpdate({
        target: toolPolicies.toolName,
        set: {
          riskLevel: record.riskLevel,
          requiresConfirmation: record.requiresConfirmation ?? true,
          enabled: record.enabled ?? true,
          updatedAt: new Date(),
        },
      })
      .run();

    return {
      toolName: record.toolName,
      riskLevel: record.riskLevel,
      requiresConfirmation: record.requiresConfirmation ?? true,
      enabled: record.enabled ?? true,
    };
  }
}
