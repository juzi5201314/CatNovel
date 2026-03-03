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

    const comment =
      typeof (bodyResult.data as { comment?: unknown })?.comment === "string"
        ? (bodyResult.data as { comment: string }).comment
        : undefined;

    const approval = approvalsRepository.getById(id);
    if (!approval) {
      return fail("NOT_FOUND", "Approval request not found", 404);
    }
    if (approval.status === "approved" || approval.status === "executed") {
      return ok({ status: approval.status });
    }
    if (approval.status !== "pending") {
      return fail("INVALID_STATE", `Approval status cannot be approved: ${approval.status}`, 409);
    }

    let changed = false;
    try {
      changed = approvalsRepository.transition({
        approvalId: id,
        toStatus: "approved",
        reason: comment ?? "Approved by user",
      });
    } catch (transitionError) {
      return fail(
        "INVALID_TRANSITION",
        transitionError instanceof Error ? transitionError.message : "invalid approval transition",
        409,
      );
    }

    if (!changed) {
      return fail("STATE_NOT_CHANGED", "Approval status update failed", 409);
    }

    return ok({ status: "approved" as const });
  } catch (error) {
    return internalError(error);
  }
}
