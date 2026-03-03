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
  "system.listTools": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "chapter.list": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "chapter.get": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "chapter.getContent": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "chapter.search": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "chapter.range": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "project.getOverview": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "rag.search": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "rag.getEvidence": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "snapshot.list": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "approval.listPending": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "timeline.getEntity": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "timeline.listEvents": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "lore.listNodes": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "lore.getNode": { riskLevel: "read", requiresConfirmation: false, enabled: true },
  "chapter.create": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "chapter.updateMeta": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "chapter.updateContent": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "chapter.reorder": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "timeline.upsertEvent": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "timeline.editEvent": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "timeline.resolveConflict": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "lore.upsertNode": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "lore.deleteNode": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "rag.reindex": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "snapshot.create": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "approval.approve": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "approval.reject": { riskLevel: "write", requiresConfirmation: true, enabled: true },
  "chapter.delete": {
    riskLevel: "high_risk",
    requiresConfirmation: true,
    enabled: true,
  },
  "snapshot.restore": {
    riskLevel: "high_risk",
    requiresConfirmation: true,
    enabled: true,
  },
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
      toolName: "system.listTools",
      riskLevel: "read",
      expectedStatus: "executed",
    },
    {
      toolName: "chapter.list",
      riskLevel: "read",
      expectedStatus: "executed",
    },
    {
      toolName: "chapter.updateContent",
      riskLevel: "write",
      expectedStatus: "requires_approval",
    },
    {
      toolName: "chapter.delete",
      riskLevel: "high_risk",
      expectedStatus: "requires_approval",
    },
    {
      toolName: "snapshot.restore",
      riskLevel: "high_risk",
      expectedStatus: "requires_approval",
    },
    {
      toolName: "approval.listPending",
      riskLevel: "read",
      expectedStatus: "executed",
    },
    {
      toolName: "approval.approve",
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
