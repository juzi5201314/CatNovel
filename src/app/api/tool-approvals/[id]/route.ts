import { internalError, fail, ok } from "@/lib/http/api-response";
import { ToolApprovalsRepository } from "@/repositories/tool-approvals-repository";
import { ToolExecutionLogsRepository } from "@/repositories/tool-execution-logs-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const approvalsRepository = new ToolApprovalsRepository();
const executionLogsRepository = new ToolExecutionLogsRepository();

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return fail("INVALID_PARAM", "id is required", 400);
    }

    const approval = approvalsRepository.getById(id);
    if (!approval) {
      return fail("NOT_FOUND", "Approval request not found", 404);
    }

    const logs = executionLogsRepository.listByApprovalId(id).map((row) => ({
      id: row.id,
      toolName: row.toolName,
      inputPayload: row.inputPayload,
      outputPayload: row.outputPayload,
      execStatus: row.execStatus,
      createdAt: row.createdAt.toISOString(),
    }));

    return ok({
      id: approval.id,
      projectId: approval.projectId,
      toolName: approval.toolName,
      riskLevel: approval.riskLevel,
      requestPayload: approval.requestPayload,
      status: approval.status,
      reason: approval.reason,
      requestedAt: approval.requestedAt.toISOString(),
      approvedAt: approval.approvedAt ? approval.approvedAt.toISOString() : null,
      executedAt: approval.executedAt ? approval.executedAt.toISOString() : null,
      expiresAt: approval.expiresAt ? approval.expiresAt.toISOString() : null,
      logs,
    });
  } catch (error) {
    return internalError(error);
  }
}
