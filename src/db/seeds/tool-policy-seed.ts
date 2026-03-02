import type { AppDatabase } from "@/db/client";
import { getDatabase } from "@/db/client";
import { toolPolicies } from "@/db/schema";

const BUILTIN_TOOL_POLICIES = [
  { toolName: "rag.search", riskLevel: "read" as const, requiresConfirmation: false },
  { toolName: "rag.getEvidence", riskLevel: "read" as const, requiresConfirmation: false },
  { toolName: "timeline.getEntity", riskLevel: "read" as const, requiresConfirmation: false },
  { toolName: "timeline.listEvents", riskLevel: "read" as const, requiresConfirmation: false },
  { toolName: "timeline.upsertEvent", riskLevel: "write" as const, requiresConfirmation: true },
  { toolName: "timeline.editEvent", riskLevel: "write" as const, requiresConfirmation: true },
  { toolName: "lore.upsertNode", riskLevel: "write" as const, requiresConfirmation: true },
  { toolName: "lore.deleteNode", riskLevel: "write" as const, requiresConfirmation: true },
  { toolName: "rag.reindex", riskLevel: "write" as const, requiresConfirmation: true },
  { toolName: "settings.providers.rotateKey", riskLevel: "high_risk" as const, requiresConfirmation: true },
  { toolName: "settings.providers.delete", riskLevel: "high_risk" as const, requiresConfirmation: true },
  {
    toolName: "settings.modelPresets.deleteBuiltinLocked",
    riskLevel: "high_risk" as const,
    requiresConfirmation: true,
  },
];

export function seedToolPolicies(database?: AppDatabase): void {
  const db = database ?? getDatabase();

  for (const policy of BUILTIN_TOOL_POLICIES) {
    db.insert(toolPolicies)
      .values({
        ...policy,
        enabled: true,
      })
      .onConflictDoUpdate({
        target: toolPolicies.toolName,
        set: {
          riskLevel: policy.riskLevel,
          requiresConfirmation: policy.requiresConfirmation,
          enabled: true,
          updatedAt: new Date(),
        },
      })
      .run();
  }
}
