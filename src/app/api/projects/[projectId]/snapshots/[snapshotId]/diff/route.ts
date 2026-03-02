import { internalError, fail, ok } from "@/lib/http/api-response";
import { ProjectSnapshotsService } from "@/core/snapshots/snapshot-service";

type RouteContext = {
  params: Promise<{ projectId: string; snapshotId: string }>;
};

const snapshotsService = new ProjectSnapshotsService();

function parseBoolean(rawValue: string | null): boolean | null {
  if (rawValue === null) {
    return null;
  }
  if (rawValue === "true") {
    return true;
  }
  if (rawValue === "false") {
    return false;
  }
  return null;
}

function mapDiffError(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }
  if (error.message === "snapshot not found") {
    return fail("NOT_FOUND", "Snapshot not found", 404);
  }
  if (error.message === "baseline snapshot not found") {
    return fail("NOT_FOUND", "Baseline snapshot not found", 404);
  }
  return null;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { projectId, snapshotId } = await context.params;
    if (!projectId) {
      return fail("INVALID_PARAM", "projectId is required", 400);
    }
    if (!snapshotId) {
      return fail("INVALID_PARAM", "snapshotId is required", 400);
    }

    const url = new URL(request.url);
    const againstSnapshotId = url.searchParams.get("against");
    if (againstSnapshotId !== null && againstSnapshotId.trim().length === 0) {
      return fail("INVALID_QUERY", "against cannot be empty", 400);
    }

    const includeUnchangedRaw = url.searchParams.get("includeUnchanged");
    const includeUnchanged = parseBoolean(includeUnchangedRaw);
    if (includeUnchangedRaw !== null && includeUnchanged === null) {
      return fail("INVALID_QUERY", "includeUnchanged must be true or false", 400);
    }

    const diff = snapshotsService.diffSnapshots(projectId, snapshotId, {
      againstSnapshotId: againstSnapshotId ?? undefined,
      includeUnchangedChapters: includeUnchanged ?? false,
    });

    return ok({
      diff: {
        beforeSnapshot: diff.beforeSnapshot,
        afterSnapshot: diff.afterSnapshot,
        chapters: diff.chapters,
        timeline: diff.timeline,
      },
    });
  } catch (error) {
    const mapped = mapDiffError(error);
    if (mapped) {
      return mapped;
    }
    return internalError(error);
  }
}
