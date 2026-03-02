import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import { ProjectSnapshotsService } from "@/core/snapshots/snapshot-service";

type RouteContext = {
  params: Promise<{ projectId: string; snapshotId: string }>;
};

const snapshotsService = new ProjectSnapshotsService();

function mapRestoreError(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  if (error.message === "project not found") {
    return fail("NOT_FOUND", "Project not found", 404);
  }
  if (error.message === "snapshot not found") {
    return fail("NOT_FOUND", "Snapshot not found", 404);
  }
  if (error.message === "snapshot projectId mismatch") {
    return fail("INVALID_STATE", "Snapshot project mismatch", 409);
  }
  return null;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId, snapshotId } = await context.params;
    if (!projectId) {
      return fail("INVALID_PARAM", "projectId is required", 400);
    }
    if (!snapshotId) {
      return fail("INVALID_PARAM", "snapshotId is required", 400);
    }

    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }
    if (typeof bodyResult.data !== "object" || bodyResult.data === null) {
      return fail("INVALID_INPUT", "Body must be an object", 400);
    }

    const record = bodyResult.data as Record<string, unknown>;
    if (record.reason !== undefined && typeof record.reason !== "string") {
      return fail("INVALID_INPUT", "reason must be a string", 400);
    }

    const result = snapshotsService.restoreSnapshot(
      projectId,
      snapshotId,
      typeof record.reason === "string" ? record.reason : undefined,
    );
    return ok({
      restore: result,
    });
  } catch (error) {
    const mapped = mapRestoreError(error);
    if (mapped) {
      return mapped;
    }
    return internalError(error);
  }
}
