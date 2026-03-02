import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import { ToolApprovalsRepository } from "@/repositories/tool-approvals-repository";
import { ToolExecutionLogsRepository } from "@/repositories/tool-execution-logs-repository";
import { executeTool } from "@/core/tools/tool-registry";
import { resolveToolPolicy, runRiskRegressionMatrix } from "@/core/tools/risk-policy";

type ExecuteToolRequest = {
  projectId: string;
  toolName: string;
  args?: unknown;
  idempotencyKey?: string;
  approvalId?: string;
};

function validateExecuteRequest(payload: unknown): ExecuteToolRequest | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.projectId !== "string" || record.projectId.trim().length === 0) {
    return null;
  }
  if (typeof record.toolName !== "string" || record.toolName.trim().length === 0) {
    return null;
  }

  return {
    projectId: record.projectId,
    toolName: record.toolName,
    args: record.args,
    idempotencyKey:
      typeof record.idempotencyKey === "string" ? record.idempotencyKey : undefined,
    approvalId: typeof record.approvalId === "string" ? record.approvalId : undefined,
  };
}

const approvalsRepository = new ToolApprovalsRepository();
const logsRepository = new ToolExecutionLogsRepository();

export async function POST(request: Request) {
  try {
    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const payload = validateExecuteRequest(bodyResult.data);
    if (!payload) {
      return fail("INVALID_INPUT", "projectId and toolName are required", 400);
    }

    const policy = resolveToolPolicy(payload.toolName);
    if (!policy.enabled) {
      return fail("TOOL_DISABLED", `Tool ${payload.toolName} is disabled`, 403);
    }

    if (policy.riskLevel !== "read" || policy.requiresConfirmation) {
      if (!payload.approvalId) {
        const approval = approvalsRepository.create({
          projectId: payload.projectId,
          toolName: payload.toolName,
          riskLevel: policy.riskLevel,
          requestPayload: payload,
          reason: "Awaiting user approval",
        });

        if (!approval) {
          return fail("APPROVAL_CREATE_FAILED", "Failed to create approval request", 500);
        }

        return ok({
          status: "requires_approval" as const,
          approvalId: approval.id,
          summary: `${payload.toolName} requires approval (${policy.riskLevel})`,
          regression: runRiskRegressionMatrix(),
        });
      }

      const approval = approvalsRepository.getById(payload.approvalId);
      if (!approval) {
        return fail("NOT_FOUND", "Approval request not found", 404);
      }
      if (approval.status !== "approved") {
        return fail(
          "APPROVAL_NOT_READY",
          `Approval status must be approved, current=${approval.status}`,
          409,
        );
      }
      if (approval.toolName !== payload.toolName || approval.projectId !== payload.projectId) {
        return fail("APPROVAL_MISMATCH", "Approval does not match tool/project", 409);
      }

      try {
        const result = await executeTool({
          projectId: payload.projectId,
          toolName: payload.toolName,
          args: payload.args,
        });

        logsRepository.create({
          approvalId: approval.id,
          toolName: payload.toolName,
          inputPayload: payload,
          outputPayload: result,
          execStatus: "succeeded",
        });

        approvalsRepository.transition({
          approvalId: approval.id,
          toStatus: "executed",
          reason: "Executed after approval",
        });

        return ok({
          status: "executed" as const,
          result,
        });
      } catch (error) {
        logsRepository.create({
          approvalId: approval.id,
          toolName: payload.toolName,
          inputPayload: payload,
          outputPayload: {
            message: error instanceof Error ? error.message : "Unknown execution error",
          },
          execStatus: "failed",
        });
        throw error;
      }
    }

    try {
      const result = await executeTool({
        projectId: payload.projectId,
        toolName: payload.toolName,
        args: payload.args,
      });

      logsRepository.create({
        approvalId: null,
        toolName: payload.toolName,
        inputPayload: payload,
        outputPayload: result,
        execStatus: "succeeded",
      });

      return ok({
        status: "executed" as const,
        result,
      });
    } catch (error) {
      logsRepository.create({
        approvalId: null,
        toolName: payload.toolName,
        inputPayload: payload,
        outputPayload: {
          message: error instanceof Error ? error.message : "Unknown execution error",
        },
        execStatus: "failed",
      });
      throw error;
    }
  } catch (error) {
    return internalError(error);
  }
}
