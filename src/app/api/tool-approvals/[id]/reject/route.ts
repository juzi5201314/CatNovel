import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import { ToolApprovalsRepository } from "@/repositories/tool-approvals-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const approvalsRepository = new ToolApprovalsRepository();

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return fail("INVALID_PARAM", "id is required", 400);
    }

    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const reason =
      typeof (bodyResult.data as { reason?: unknown })?.reason === "string"
        ? (bodyResult.data as { reason: string }).reason
        : undefined;

    const approval = approvalsRepository.getById(id);
    if (!approval) {
      return fail("NOT_FOUND", "Approval request not found", 404);
    }

    const changed = approvalsRepository.transition({
      approvalId: id,
      toStatus: "rejected",
      reason: reason ?? "Rejected by user",
    });

    if (!changed) {
      return fail("STATE_NOT_CHANGED", "Approval status update failed", 409);
    }

    return ok({ status: "rejected" as const });
  } catch (error) {
    return internalError(error);
  }
}
