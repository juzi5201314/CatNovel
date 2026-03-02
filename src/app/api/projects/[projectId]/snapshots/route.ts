import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import { ProjectSnapshotsService } from "@/core/snapshots/snapshot-service";
import { ProjectsRepository } from "@/repositories/projects-repository";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

const projectsRepository = new ProjectsRepository();
const snapshotsService = new ProjectSnapshotsService();

function parseLimit(rawLimit: string | null): number | null {
  if (rawLimit === null) {
    return null;
  }

  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    if (!projectId) {
      return fail("INVALID_PARAM", "projectId is required", 400);
    }

    const project = projectsRepository.findById(projectId);
    if (!project) {
      return fail("NOT_FOUND", "Project not found", 404);
    }

    const url = new URL(request.url);
    const rawLimit = url.searchParams.get("limit");
    const limit = parseLimit(rawLimit);
    if (rawLimit !== null && limit === null) {
      return fail("INVALID_QUERY", "limit must be a positive integer", 400);
    }

    const snapshots = snapshotsService.listSnapshots(projectId, limit ?? 20);
    return ok({
      snapshots: snapshots.map((snapshot) => ({
        id: snapshot.id,
        projectId: snapshot.projectId,
        sourceChapterId: snapshot.sourceChapterId,
        sourceSnapshotId: snapshot.sourceSnapshotId,
        triggerType: snapshot.triggerType,
        triggerReason: snapshot.triggerReason,
        chapterCount: snapshot.chapterCount,
        timelineEventCount: snapshot.timelineEventCount,
        timelineSummary: snapshot.timelineSummary,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      })),
    });
  } catch (error) {
    return internalError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    if (!projectId) {
      return fail("INVALID_PARAM", "projectId is required", 400);
    }

    const project = projectsRepository.findById(projectId);
    if (!project) {
      return fail("NOT_FOUND", "Project not found", 404);
    }

    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const payload = bodyResult.data;
    if (typeof payload !== "object" || payload === null) {
      return fail("INVALID_INPUT", "Body must be an object", 400);
    }

    const record = payload as Record<string, unknown>;
    if (record.reason !== undefined && typeof record.reason !== "string") {
      return fail("INVALID_INPUT", "reason must be a string", 400);
    }

    const reason = typeof record.reason === "string" ? record.reason : undefined;
    const result = snapshotsService.createManualSnapshot(projectId, reason);
    return ok(
      {
        snapshot: {
          id: result.snapshot.id,
          projectId: result.snapshot.projectId,
          sourceChapterId: result.snapshot.sourceChapterId,
          sourceSnapshotId: result.snapshot.sourceSnapshotId,
          triggerType: result.snapshot.triggerType,
          triggerReason: result.snapshot.triggerReason,
          chapterCount: result.snapshot.chapterCount,
          timelineEventCount: result.snapshot.timelineEventCount,
          timelineSummary: result.snapshot.timelineSummary,
          createdAt: result.snapshot.createdAt,
          updatedAt: result.snapshot.updatedAt,
        },
      },
      201,
    );
  } catch (error) {
    return internalError(error);
  }
}
