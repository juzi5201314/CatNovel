import type { ToolRiskLevel } from "@/db/schema";
import { ToolPoliciesRepository } from "@/repositories/tool-policies-repository";

export type ResolvedToolPolicy = {
  toolName: string;
  riskLevel: ToolRiskLevel;
  requiresConfirmation: boolean;
  enabled: boolean;
};

export type RiskRegressionCase = {
  toolName: string;
  riskLevel: ToolRiskLevel;
  expectedStatus: "executed" | "requires_approval";
};

const fallbackPolicies: Record<string, Omit<ResolvedToolPolicy, "toolName">> = {
  "rag.search": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "rag.getEvidence": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "timeline.getEntity": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "timeline.listEvents": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "timeline.upsertEvent": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "timeline.editEvent": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "lore.upsertNode": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "lore.deleteNode": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "rag.reindex": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "settings.providers.rotateKey": {
    riskLevel: "high_risk",
    requiresConfirmation: true,
    enabled: true,
  },
  "settings.providers.delete": {
    riskLevel: "high_risk",
    requiresConfirmation: true,
    enabled: true,
  },
  "settings.modelPresets.deleteBuiltinLocked": {
    riskLevel: "high_risk",
    requiresConfirmation: true,
    enabled: true,
  },
};

export function resolveToolPolicy(toolName: string): ResolvedToolPolicy {
  const repository = new ToolPoliciesRepository();
  const dbPolicy = repository.findByToolName(toolName);

  if (dbPolicy) {
    return {
      toolName,
      riskLevel: dbPolicy.riskLevel,
      requiresConfirmation: dbPolicy.requiresConfirmation,
      enabled: dbPolicy.enabled,
    };
  }

  const fallback = fallbackPolicies[toolName];
  if (fallback) {
    return {
      toolName,
      ...fallback,
    };
  }

  return {
    toolName,
    riskLevel: "high_risk",
    requiresConfirmation: true,
    enabled: false,
  };
}

export function getRiskRegressionMatrix(): RiskRegressionCase[] {
  return [
    {
      toolName: "rag.search",
      riskLevel: "read",
      expectedStatus: "executed",
    },
    {
      toolName: "timeline.upsertEvent",
      riskLevel: "write",
      expectedStatus: "requires_approval",
    },
    {
      toolName: "settings.providers.rotateKey",
      riskLevel: "high_risk",
      expectedStatus: "requires_approval",
    },
  ];
}

export function runRiskRegressionMatrix(): { passed: boolean; mismatches: string[] } {
  const mismatches: string[] = [];

  for (const testCase of getRiskRegressionMatrix()) {
    const policy = resolveToolPolicy(testCase.toolName);
    const actualStatus =
      policy.riskLevel === "read" && !policy.requiresConfirmation
        ? "executed"
        : "requires_approval";

    if (policy.riskLevel !== testCase.riskLevel || actualStatus !== testCase.expectedStatus) {
      mismatches.push(
        `${testCase.toolName}: expected(${testCase.riskLevel},${testCase.expectedStatus}) got(${policy.riskLevel},${actualStatus})`,
      );
    }
  }

  return {
    passed: mismatches.length === 0,
    mismatches,
  };
}
