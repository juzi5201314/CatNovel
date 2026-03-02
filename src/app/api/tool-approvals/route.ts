import { internalError, fail, ok } from "@/lib/http/api-response";
import { ToolApprovalsRepository } from "@/repositories/tool-approvals-repository";
import type { ToolApprovalStatus } from "@/db/schema";

const approvalsRepository = new ToolApprovalsRepository();
const allowedStatuses = new Set<ToolApprovalStatus>([
  "pending",
  "approved",
  "rejected",
  "expired",
  "executed",
]);

function formatApprovalSummary(requestPayload: string): string {
  try {
    const parsed = JSON.parse(requestPayload) as { toolName?: string };
    if (typeof parsed.toolName === "string") {
      return `Request to execute ${parsed.toolName}`;
    }
  } catch {
    return "Tool approval request";
  }

  return "Tool approval request";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    const status = url.searchParams.get("status");

    if (!projectId) {
      return fail("INVALID_QUERY", "projectId is required", 400);
    }

    if (status && !allowedStatuses.has(status as ToolApprovalStatus)) {
      return fail("INVALID_QUERY", "status is invalid", 400);
    }

    const rows = approvalsRepository.listByProject(
      projectId,
      (status as ToolApprovalStatus | null) ?? undefined,
    );

    const approvals = rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      toolName: row.toolName,
      riskLevel: row.riskLevel,
      status: row.status,
      summary: formatApprovalSummary(row.requestPayload),
      requestedAt: row.requestedAt.toISOString(),
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    }));

    return ok(approvals);
  } catch (error) {
    return internalError(error);
  }
}
