import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import { RetrievalIndexer } from "@/core/retrieval/indexer";
import {
  createQueuedJob,
  markJobDone,
  markJobFailed,
  markJobRunning,
  type RagReindexReason,
} from "@/core/retrieval/runtime";

type ReindexRequest = {
  projectId: string;
  chapterIds?: string[];
  reason: RagReindexReason;
};

const indexer = new RetrievalIndexer();

function validateReindexRequest(payload: unknown): ReindexRequest | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.projectId !== "string" || record.projectId.trim().length === 0) {
    return null;
  }
  if (record.reason !== "chapter_updated" && record.reason !== "full_rebuild") {
    return null;
  }

  let chapterIds: string[] | undefined;
  if (record.chapterIds !== undefined) {
    if (!Array.isArray(record.chapterIds)) {
      return null;
    }
    chapterIds = [];
    for (const item of record.chapterIds) {
      if (typeof item !== "string" || item.trim().length === 0) {
        return null;
      }
      chapterIds.push(item.trim());
    }
  }

  return {
    projectId: record.projectId.trim(),
    chapterIds,
    reason: record.reason,
  };
}

async function executeReindex(jobId: string, input: ReindexRequest): Promise<void> {
  markJobRunning(jobId);
  try {
    const summary = await indexer.reindex({
      projectId: input.projectId,
      chapterIds: input.chapterIds,
    });
    markJobDone(jobId, summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "reindex failed";
    markJobFailed(jobId, message);
  }
}

export async function POST(request: Request) {
  try {
    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const input = validateReindexRequest(bodyResult.data);
    if (!input) {
      return fail(
        "INVALID_INPUT",
        "projectId/reason required; reason must be chapter_updated|full_rebuild",
        400,
      );
    }

    const job = createQueuedJob({
      projectId: input.projectId,
      reason: input.reason,
      chapterCount: input.chapterIds?.length ?? 0,
    });

    void executeReindex(job.jobId, input);
    return ok({ jobId: job.jobId, status: "queued" as const });
  } catch (error) {
    return internalError(error);
  }
}
