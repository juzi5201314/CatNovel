import { ToolApprovalsRepository } from "@/repositories/tool-approvals-repository";
import { ToolExecutionLogsRepository } from "@/repositories/tool-execution-logs-repository";
import { executeTool } from "@/core/tools/tool-registry";
import { resolveToolPolicy, runRiskRegressionMatrix } from "@/core/tools/risk-policy";

export type ExecuteManagedToolRequest = {
  projectId: string;
  toolName: string;
  args?: unknown;
  idempotencyKey?: string;
  approvalId?: string;
  caller?: "llm" | "user";
};

export type ExecuteManagedToolResult =
  | {
      status: "requires_approval";
      approvalId: string;
      summary: string;
      regression: ReturnType<typeof runRiskRegressionMatrix>;
    }
  | {
      status: "executed";
      result: unknown;
    };

type ServiceErrorOptions = {
  code: string;
  message: string;
  status: number;
  details?: unknown;
};

export class ToolExecutionServiceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(options: ServiceErrorOptions) {
    super(options.message);
    this.name = "ToolExecutionServiceError";
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
  }
}

export function isToolExecutionServiceError(error: unknown): error is ToolExecutionServiceError {
  return error instanceof ToolExecutionServiceError;
}

const approvalsRepository = new ToolApprovalsRepository();
const logsRepository = new ToolExecutionLogsRepository();
const SELF_APPROVAL_TOOLS = new Set(["approval.approve", "approval.reject"]);

function ensureToolEnabled(toolName: string): void {
  const policy = resolveToolPolicy(toolName);
  if (policy.enabled) {
    return;
  }

  throw new ToolExecutionServiceError({
    code: "TOOL_DISABLED",
    message: `Tool ${toolName} is disabled`,
    status: 403,
  });
}

function requiresApproval(toolName: string, caller: "llm" | "user"): boolean {
  if (caller === "user") {
    return false;
  }

  if (SELF_APPROVAL_TOOLS.has(toolName)) {
    return false;
  }
  const policy = resolveToolPolicy(toolName);
  return policy.riskLevel !== "read" || policy.requiresConfirmation;
}

async function runTool(input: ExecuteManagedToolRequest): Promise<unknown> {
  return executeTool({
    projectId: input.projectId,
    toolName: input.toolName,
    args: input.args,
  });
}

function assertApprovalReady(input: ExecuteManagedToolRequest) {
  const approval = approvalsRepository.getById(input.approvalId as string);
  if (!approval) {
    throw new ToolExecutionServiceError({
      code: "NOT_FOUND",
      message: "Approval request not found",
      status: 404,
    });
  }
  if (approval.status !== "approved") {
    throw new ToolExecutionServiceError({
      code: "APPROVAL_NOT_READY",
      message: `Approval status must be approved, current=${approval.status}`,
      status: 409,
    });
  }
  if (approval.toolName !== input.toolName || approval.projectId !== input.projectId) {
    throw new ToolExecutionServiceError({
      code: "APPROVAL_MISMATCH",
      message: "Approval does not match tool/project",
      status: 409,
    });
  }
  return approval;
}

async function executeAfterApproval(
  input: ExecuteManagedToolRequest,
): Promise<ExecuteManagedToolResult> {
  const approval = assertApprovalReady(input);

  try {
    const result = await runTool(input);

    logsRepository.create({
      approvalId: approval.id,
      toolName: input.toolName,
      inputPayload: input,
      outputPayload: result,
      execStatus: "succeeded",
    });

    approvalsRepository.transition({
      approvalId: approval.id,
      toStatus: "executed",
      reason: "Executed after approval",
    });

    return {
      status: "executed",
      result,
    };
  } catch (error) {
    logsRepository.create({
      approvalId: approval.id,
      toolName: input.toolName,
      inputPayload: input,
      outputPayload: {
        message: error instanceof Error ? error.message : "Unknown execution error",
      },
      execStatus: "failed",
    });
    throw error;
  }
}

async function executeDirectly(
  input: ExecuteManagedToolRequest,
): Promise<ExecuteManagedToolResult> {
  try {
    const result = await runTool(input);
    logsRepository.create({
      approvalId: null,
      toolName: input.toolName,
      inputPayload: input,
      outputPayload: result,
      execStatus: "succeeded",
    });
    return {
      status: "executed",
      result,
    };
  } catch (error) {
    logsRepository.create({
      approvalId: null,
      toolName: input.toolName,
      inputPayload: input,
      outputPayload: {
        message: error instanceof Error ? error.message : "Unknown execution error",
      },
      execStatus: "failed",
    });
    throw error;
  }
}

function createApprovalRequest(input: ExecuteManagedToolRequest): ExecuteManagedToolResult {
  const policy = resolveToolPolicy(input.toolName);
  const approval = approvalsRepository.create({
    projectId: input.projectId,
    toolName: input.toolName,
    riskLevel: policy.riskLevel,
    requestPayload: input,
    reason: "Awaiting user approval",
  });

  if (!approval) {
    throw new ToolExecutionServiceError({
      code: "APPROVAL_CREATE_FAILED",
      message: "Failed to create approval request",
      status: 500,
    });
  }

  return {
    status: "requires_approval",
    approvalId: approval.id,
    summary: `${input.toolName} requires approval (${policy.riskLevel})`,
    regression: runRiskRegressionMatrix(),
  };
}

export async function executeManagedTool(
  input: ExecuteManagedToolRequest,
): Promise<ExecuteManagedToolResult> {
  const caller = input.caller ?? "llm";
  ensureToolEnabled(input.toolName);

  if (!requiresApproval(input.toolName, caller)) {
    return executeDirectly(input);
  }

  if (!input.approvalId) {
    return createApprovalRequest(input);
  }

  return executeAfterApproval(input);
}
