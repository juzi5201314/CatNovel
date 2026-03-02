import type { ReindexOutput } from "./indexer";
import type { ChunkVectorRecord } from "./chunk-schema";

export type RagReindexReason = "chapter_updated" | "full_rebuild";

export type RagJob = {
  jobId: string;
  projectId: string;
  reason: RagReindexReason;
  chapterCount: number;
  status: "queued" | "running" | "done" | "failed";
  error?: string;
  updatedAt: string;
};

export type RagProjectStatus = {
  indexedChapters: number;
  indexedChunks: number;
  pendingJobs: number;
  lastBuildAt?: string;
};

type RuntimeState = {
  jobs: Map<string, RagJob>;
  projectStatus: Map<string, RagProjectStatus>;
  projectChunks: Map<string, ChunkVectorRecord[]>;
};

const RUNTIME_KEY = "__catnovel_rag_runtime_state__";

function getRuntime(): RuntimeState {
  const target = globalThis as typeof globalThis & {
    [RUNTIME_KEY]?: RuntimeState;
  };
  if (!target[RUNTIME_KEY]) {
    target[RUNTIME_KEY] = {
      jobs: new Map(),
      projectStatus: new Map(),
      projectChunks: new Map(),
    };
  }
  return target[RUNTIME_KEY];
}

function nowIso(): string {
  return new Date().toISOString();
}

function ensureProjectStatus(projectId: string): RagProjectStatus {
  const runtime = getRuntime();
  const existing = runtime.projectStatus.get(projectId);
  if (existing) {
    return existing;
  }
  const initial: RagProjectStatus = {
    indexedChapters: 0,
    indexedChunks: 0,
    pendingJobs: 0,
    lastBuildAt: undefined,
  };
  runtime.projectStatus.set(projectId, initial);
  return initial;
}

export function createQueuedJob(input: {
  projectId: string;
  reason: RagReindexReason;
  chapterCount: number;
}): RagJob {
  const runtime = getRuntime();
  const jobId = crypto.randomUUID();
  const job: RagJob = {
    jobId,
    projectId: input.projectId,
    reason: input.reason,
    chapterCount: input.chapterCount,
    status: "queued",
    updatedAt: nowIso(),
  };
  runtime.jobs.set(jobId, job);

  const status = ensureProjectStatus(input.projectId);
  status.pendingJobs += 1;
  runtime.projectStatus.set(input.projectId, status);

  return job;
}

export function markJobRunning(jobId: string): void {
  const runtime = getRuntime();
  const job = runtime.jobs.get(jobId);
  if (!job) {
    return;
  }
  job.status = "running";
  job.updatedAt = nowIso();
  runtime.jobs.set(jobId, job);
}

export function markJobDone(jobId: string, summary: ReindexOutput): void {
  const runtime = getRuntime();
  const job = runtime.jobs.get(jobId);
  if (!job) {
    return;
  }
  job.status = "done";
  job.updatedAt = nowIso();
  runtime.jobs.set(jobId, job);

  const status = ensureProjectStatus(job.projectId);
  status.pendingJobs = Math.max(0, status.pendingJobs - 1);
  status.indexedChapters = summary.indexedChapters;
  status.indexedChunks = summary.indexedChunks;
  status.lastBuildAt = summary.lastBuildAt;
  runtime.projectStatus.set(job.projectId, status);
}

export function markJobFailed(jobId: string, error: string): void {
  const runtime = getRuntime();
  const job = runtime.jobs.get(jobId);
  if (!job) {
    return;
  }
  job.status = "failed";
  job.error = error;
  job.updatedAt = nowIso();
  runtime.jobs.set(jobId, job);

  const status = ensureProjectStatus(job.projectId);
  status.pendingJobs = Math.max(0, status.pendingJobs - 1);
  runtime.projectStatus.set(job.projectId, status);
}

export function getProjectStatus(projectId: string): RagProjectStatus {
  return ensureProjectStatus(projectId);
}

export function getJob(jobId: string): RagJob | null {
  return getRuntime().jobs.get(jobId) ?? null;
}

export function getProjectChunks(projectId: string): ChunkVectorRecord[] {
  return getRuntime().projectChunks.get(projectId) ?? [];
}

export function replaceProjectChunks(projectId: string, chunks: ChunkVectorRecord[]): void {
  getRuntime().projectChunks.set(projectId, chunks);
}
