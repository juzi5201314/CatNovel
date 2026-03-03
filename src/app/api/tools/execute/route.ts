import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import {
  executeManagedTool,
  isToolExecutionServiceError,
} from "@/core/tools/tool-execution-service";

type ExecuteToolRequest = {
  projectId: string;
  toolName: string;
  args?: unknown;
  idempotencyKey?: string;
  approvalId?: string;
  caller?: "llm" | "user";
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
  if (record.caller !== undefined && record.caller !== "llm" && record.caller !== "user") {
    return null;
  }

  return {
    projectId: record.projectId,
    toolName: record.toolName,
    args: record.args,
    idempotencyKey:
      typeof record.idempotencyKey === "string" ? record.idempotencyKey : undefined,
    approvalId: typeof record.approvalId === "string" ? record.approvalId : undefined,
    caller: record.caller === "llm" || record.caller === "user" ? record.caller : undefined,
  };
}

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

    const result = await executeManagedTool(payload);
    return ok(result);
  } catch (error) {
    if (isToolExecutionServiceError(error)) {
      return fail(error.code, error.message, error.status, error.details);
    }
    return internalError(error);
  }
}
