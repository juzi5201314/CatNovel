"use client";

import { create } from "zustand";

import type {
  ApiResponse,
  ApiSuccess,
  ChapterItem,
  ChapterSaveResponse,
  ImportErrorReport,
  ProjectImportResult,
  ProjectItem,
  ProjectMode,
  ProjectSnapshotDiff,
  ProjectSnapshotSummary,
  SnapshotRestoreResult,
} from "@/components/workspace/types";

type SaveChapterPayload = {
  content: string;
  summary?: string | null;
};

type WorkspaceState = {
  projects: ProjectItem[];
  chapters: ChapterItem[];
  snapshots: ProjectSnapshotSummary[];
  snapshotDiff: ProjectSnapshotDiff | null;
  snapshotRestoreResult: SnapshotRestoreResult | null;
  selectedProjectId: string | null;
  selectedChapterId: string | null;
  loadingProjects: boolean;
  loadingChapters: boolean;
  loadingSnapshots: boolean;
  loadingSnapshotDiff: boolean;
  creatingProject: boolean;
  renamingProject: boolean;
  deletingProject: boolean;
  creatingChapter: boolean;
  savingChapter: boolean;
  creatingSnapshot: boolean;
  restoringSnapshotId: string | null;
  importingProject: boolean;
  exportingProject: boolean;
  importResult: ProjectImportResult | null;
  importErrorReport: ImportErrorReport | null;
  lastExportJson: string | null;
  error: string | null;
  fetchProjects: () => Promise<void>;
  createProject: (input: { name: string; mode: ProjectMode }) => Promise<void>;
  renameProject: (input: { projectId: string; name: string }) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  selectProject: (projectId: string | null) => Promise<void>;
  fetchChapters: (projectId: string) => Promise<void>;
  fetchSnapshots: (projectId: string) => Promise<void>;
  createChapter: (input: { title: string }) => Promise<void>;
  selectChapter: (chapterId: string | null) => void;
  saveChapter: (payload: SaveChapterPayload) => Promise<void>;
  importProjectFromJson: (rawJson: string) => Promise<void>;
  exportSelectedProject: () => Promise<void>;
  createManualSnapshot: (reason?: string) => Promise<void>;
  restoreSnapshot: (snapshotId: string, reason?: string) => Promise<void>;
  loadSnapshotDiff: (snapshotId: string, againstSnapshotId?: string) => Promise<void>;
  clearSnapshotDiff: () => void;
  clearImportFeedback: () => void;
  clearError: () => void;
};

class ApiRequestError extends Error {
  readonly code: string;
  readonly details: unknown;
  readonly status: number;

  constructor(input: {
    message: string;
    code?: string;
    details?: unknown;
    status?: number;
  }) {
    super(input.message);
    this.name = "ApiRequestError";
    this.code = input.code ?? "REQUEST_FAILED";
    this.details = input.details;
    this.status = input.status ?? 500;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

function normalizeError(reason: unknown, fallback: string): string {
  if (reason instanceof Error) {
    return reason.message;
  }
  if (typeof reason === "string" && reason.trim().length > 0) {
    return reason;
  }
  return fallback;
}

async function readJson<T>(response: Response): Promise<ApiSuccess<T>> {
  let json: ApiResponse<T>;
  try {
    json = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiRequestError({
      message: "响应解析失败",
      code: "INVALID_JSON_RESPONSE",
      status: response.status,
    });
  }

  if (!response.ok || !json.success) {
    if (!json.success) {
      throw new ApiRequestError({
        message: json.error.message,
        code: json.error.code,
        details: json.error.details,
        status: response.status,
      });
    }
    throw new ApiRequestError({
      message: "request_failed",
      status: response.status,
    });
  }

  return json;
}

function pickInitialChapter(chapters: ChapterItem[]): string | null {
  return chapters.length > 0 ? chapters[0].id : null;
}

function normalizeImportErrorReport(raw: unknown): ImportErrorReport | null {
  if (!isRecord(raw)) {
    return null;
  }

  const stage = raw.stage;
  const hint = raw.hint;
  const recoverable = raw.recoverable;
  const issues = raw.issues;

  if (
    (stage !== "validation" &&
      stage !== "parser" &&
      stage !== "persistence" &&
      stage !== "configuration") ||
    typeof hint !== "string" ||
    typeof recoverable !== "boolean" ||
    !Array.isArray(issues)
  ) {
    return null;
  }

  const normalizedIssues: ImportErrorReport["issues"] = [];
  for (const issue of issues) {
    if (!isRecord(issue)) {
      continue;
    }

    const code = issue.code;
    const message = issue.message;
    const issueRecoverable = issue.recoverable;
    const issueHint = issue.hint;
    const target = issue.target;

    if (
      typeof code !== "string" ||
      typeof message !== "string" ||
      typeof issueRecoverable !== "boolean" ||
      typeof issueHint !== "string"
    ) {
      continue;
    }

    normalizedIssues.push({
      code,
      message,
      recoverable: issueRecoverable,
      hint: issueHint,
      target: typeof target === "string" ? target : undefined,
      details: issue.details,
    });
  }

  return {
    stage,
    hint,
    recoverable,
    issues: normalizedIssues,
  };
}

function sortSnapshots(input: ProjectSnapshotSummary[]): ProjectSnapshotSummary[] {
  return [...input].sort((left, right) => {
    const leftTs = new Date(left.createdAt).getTime();
    const rightTs = new Date(right.createdAt).getTime();
    if (leftTs !== rightTs) {
      return rightTs - leftTs;
    }
    return right.id.localeCompare(left.id);
  });
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  projects: [],
  chapters: [],
  snapshots: [],
  snapshotDiff: null,
  snapshotRestoreResult: null,
  selectedProjectId: null,
  selectedChapterId: null,
  loadingProjects: false,
  loadingChapters: false,
  loadingSnapshots: false,
  loadingSnapshotDiff: false,
  creatingProject: false,
  renamingProject: false,
  deletingProject: false,
  creatingChapter: false,
  savingChapter: false,
  creatingSnapshot: false,
  restoringSnapshotId: null,
  importingProject: false,
  exportingProject: false,
  importResult: null,
  importErrorReport: null,
  lastExportJson: null,
  error: null,

  fetchProjects: async () => {
    set({ loadingProjects: true, error: null });
    try {
      const response = await fetch("/api/projects", { method: "GET" });
      const json = await readJson<ProjectItem[]>(response);
      const projects = json.data;
      const currentProjectId = get().selectedProjectId;
      const selectedProjectId =
        currentProjectId && projects.some((project: ProjectItem) => project.id === currentProjectId)
          ? currentProjectId
          : (projects[0]?.id ?? null);

      set({
        projects,
        selectedProjectId,
        loadingProjects: false,
      });

      if (selectedProjectId) {
        await Promise.all([
          get().fetchChapters(selectedProjectId),
          get().fetchSnapshots(selectedProjectId),
        ]);
      } else {
        set({
          chapters: [],
          snapshots: [],
          snapshotDiff: null,
          snapshotRestoreResult: null,
          selectedChapterId: null,
        });
      }
    } catch (error) {
      set({
        loadingProjects: false,
        error: normalizeError(error, "项目加载失败"),
      });
    }
  },

  createProject: async (input) => {
    set({ creatingProject: true, error: null });
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await readJson<ProjectItem>(response);
      const created = json.data;
      const nextProjects = [...get().projects, created];

      set({
        projects: nextProjects,
        selectedProjectId: created.id,
        chapters: [],
        snapshots: [],
        snapshotDiff: null,
        snapshotRestoreResult: null,
        selectedChapterId: null,
        creatingProject: false,
      });

      await Promise.all([get().fetchChapters(created.id), get().fetchSnapshots(created.id)]);
    } catch (error) {
      set({
        creatingProject: false,
        error: normalizeError(error, "项目创建失败"),
      });
    }
  },

  renameProject: async ({ projectId, name }) => {
    set({ renamingProject: true, error: null });
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await readJson<ProjectItem>(response);
      const updated = json.data;

      set({
        projects: get().projects.map((project) =>
          project.id === updated.id ? updated : project,
        ),
        renamingProject: false,
      });
    } catch (error) {
      set({
        renamingProject: false,
        error: normalizeError(error, "项目重命名失败"),
      });
    }
  },

  deleteProject: async (projectId) => {
    set({ deletingProject: true, error: null });
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      await readJson<{ success: boolean; deletedProjectId: string }>(response);

      const currentSelectedProjectId = get().selectedProjectId;
      const nextProjects = get().projects.filter((project) => project.id !== projectId);
      const deletedSelectedProject = currentSelectedProjectId === projectId;

      if (!deletedSelectedProject) {
        set({
          projects: nextProjects,
          deletingProject: false,
        });
        return;
      }

      const nextSelectedProjectId = nextProjects[0]?.id ?? null;
      set({
        projects: nextProjects,
        selectedProjectId: nextSelectedProjectId,
        selectedChapterId: null,
        chapters: [],
        snapshots: [],
        snapshotDiff: null,
        snapshotRestoreResult: null,
        deletingProject: false,
      });

      if (nextSelectedProjectId) {
        await Promise.all([
          get().fetchChapters(nextSelectedProjectId),
          get().fetchSnapshots(nextSelectedProjectId),
        ]);
      }
    } catch (error) {
      set({
        deletingProject: false,
        error: normalizeError(error, "项目删除失败"),
      });
    }
  },

  selectProject: async (projectId) => {
    set({
      selectedProjectId: projectId,
      selectedChapterId: null,
      snapshotDiff: null,
      snapshotRestoreResult: null,
      error: null,
    });
    if (!projectId) {
      set({ chapters: [], snapshots: [] });
      return;
    }
    await Promise.all([get().fetchChapters(projectId), get().fetchSnapshots(projectId)]);
  },

  fetchChapters: async (projectId) => {
    set({ loadingChapters: true, error: null });
    try {
      const response = await fetch(`/api/projects/${projectId}/chapters`, {
        method: "GET",
      });
      const json = await readJson<ChapterItem[]>(response);
      const chapters = json.data.sort((a: ChapterItem, b: ChapterItem) => a.orderNo - b.orderNo);
      const currentChapterId = get().selectedChapterId;
      const selectedChapterId =
        currentChapterId && chapters.some((chapter: ChapterItem) => chapter.id === currentChapterId)
          ? currentChapterId
          : pickInitialChapter(chapters);

      if (get().selectedProjectId !== projectId) {
        return;
      }

      set({
        chapters,
        selectedChapterId,
        loadingChapters: false,
      });
    } catch (error) {
      if (get().selectedProjectId !== projectId) {
        return;
      }
      set({
        loadingChapters: false,
        error: normalizeError(error, "章节加载失败"),
      });
    }
  },

  fetchSnapshots: async (projectId) => {
    set({ loadingSnapshots: true, error: null });
    try {
      const response = await fetch(`/api/projects/${projectId}/snapshots?limit=50`, {
        method: "GET",
      });
      const json = await readJson<{ snapshots: ProjectSnapshotSummary[] }>(response);
      const snapshots = sortSnapshots(json.data.snapshots ?? []);

      if (get().selectedProjectId !== projectId) {
        return;
      }

      set({
        snapshots,
        loadingSnapshots: false,
      });
    } catch (error) {
      if (get().selectedProjectId !== projectId) {
        return;
      }
      set({
        loadingSnapshots: false,
        error: normalizeError(error, "快照加载失败"),
      });
    }
  },

  createChapter: async ({ title }) => {
    const projectId = get().selectedProjectId;
    if (!projectId) {
      set({ error: "请先选择项目" });
      return;
    }

    const nextOrderNo =
      get().chapters.reduce((max, chapter) => Math.max(max, chapter.orderNo), 0) + 1;

    set({ creatingChapter: true, error: null });
    try {
      const response = await fetch(`/api/projects/${projectId}/chapters`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, order: nextOrderNo }),
      });
      const json = await readJson<ChapterItem>(response);
      const created = json.data;
      const chapters = [...get().chapters, created].sort((a, b) => a.orderNo - b.orderNo);

      set({
        chapters,
        selectedChapterId: created.id,
        creatingChapter: false,
      });
    } catch (error) {
      set({
        creatingChapter: false,
        error: normalizeError(error, "章节创建失败"),
      });
    }
  },

  selectChapter: (chapterId) => {
    set({ selectedChapterId: chapterId });
  },

  saveChapter: async (payload) => {
    const chapterId = get().selectedChapterId;
    if (!chapterId) {
      return;
    }

    set({ savingChapter: true, error: null });
    try {
      const response = await fetch(`/api/chapters/${chapterId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await readJson<ChapterSaveResponse>(response);
      const updated = json.data.chapter;
      const chapters = get().chapters.map((chapter) =>
        chapter.id === updated.id ? { ...chapter, ...updated } : chapter,
      );

      set({
        chapters,
        savingChapter: false,
      });

      const selectedProjectId = get().selectedProjectId;
      if (json.data.autoSnapshot.created && selectedProjectId) {
        await get().fetchSnapshots(selectedProjectId);
      }
    } catch (error) {
      set({
        savingChapter: false,
        error: normalizeError(error, "章节保存失败"),
      });
      throw error;
    }
  },

  importProjectFromJson: async (rawJson) => {
    let payload: unknown;
    try {
      payload = JSON.parse(rawJson);
    } catch {
      set({
        error: "导入 JSON 解析失败",
        importResult: null,
        importErrorReport: {
          stage: "validation",
          recoverable: true,
          hint: "请修正 JSON 语法后重试",
          issues: [
            {
              code: "INVALID_JSON",
              message: "无法解析 JSON 文本",
              recoverable: true,
              hint: "检查逗号、引号与括号是否匹配",
            },
          ],
        },
      });
      return;
    }

    set({
      importingProject: true,
      importResult: null,
      importErrorReport: null,
      error: null,
    });

    try {
      const response = await fetch("/api/projects/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await readJson<ProjectImportResult>(response);
      const imported = json.data;
      const existing = get().projects.filter((project) => project.id !== imported.project.id);

      set({
        projects: [...existing, imported.project],
        selectedProjectId: imported.project.id,
        selectedChapterId: null,
        snapshots: [],
        snapshotDiff: null,
        snapshotRestoreResult: null,
        importingProject: false,
        importResult: imported,
        importErrorReport: null,
      });

      await Promise.all([
        get().fetchChapters(imported.project.id),
        get().fetchSnapshots(imported.project.id),
      ]);
    } catch (error) {
      const report = isApiRequestError(error)
        ? normalizeImportErrorReport(error.details)
        : null;
      set({
        importingProject: false,
        importResult: null,
        importErrorReport: report,
        error: normalizeError(error, "项目导入失败"),
      });
    }
  },

  exportSelectedProject: async () => {
    const projectId = get().selectedProjectId;
    if (!projectId) {
      set({ error: "请先选择项目" });
      return;
    }

    set({ exportingProject: true, error: null });
    try {
      const response = await fetch(`/api/projects/${projectId}/export`, {
        method: "GET",
      });
      const json = await readJson<unknown>(response);
      set({
        lastExportJson: JSON.stringify(json.data, null, 2),
        exportingProject: false,
      });
    } catch (error) {
      set({
        exportingProject: false,
        error: normalizeError(error, "项目导出失败"),
      });
    }
  },

  createManualSnapshot: async (reason) => {
    const projectId = get().selectedProjectId;
    if (!projectId) {
      set({ error: "请先选择项目" });
      return;
    }

    set({ creatingSnapshot: true, error: null });
    try {
      const response = await fetch(`/api/projects/${projectId}/snapshots`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: typeof reason === "string" && reason.trim().length > 0 ? reason.trim() : undefined,
        }),
      });
      const json = await readJson<{ snapshot: ProjectSnapshotSummary }>(response);
      const created = json.data.snapshot;

      set({
        creatingSnapshot: false,
        snapshotRestoreResult: null,
        snapshots: sortSnapshots([created, ...get().snapshots.filter((item) => item.id !== created.id)]),
      });
    } catch (error) {
      set({
        creatingSnapshot: false,
        error: normalizeError(error, "创建快照失败"),
      });
    }
  },

  restoreSnapshot: async (snapshotId, reason) => {
    const projectId = get().selectedProjectId;
    if (!projectId) {
      set({ error: "请先选择项目" });
      return;
    }

    set({ restoringSnapshotId: snapshotId, error: null });
    try {
      const response = await fetch(
        `/api/projects/${projectId}/snapshots/${encodeURIComponent(snapshotId)}/restore`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reason: typeof reason === "string" && reason.trim().length > 0 ? reason.trim() : undefined,
          }),
        },
      );
      const json = await readJson<{ restore: SnapshotRestoreResult }>(response);

      if (get().selectedProjectId !== projectId) {
        return;
      }

      set({
        snapshotRestoreResult: json.data.restore,
      });

      await Promise.all([get().fetchChapters(projectId), get().fetchSnapshots(projectId)]);
    } catch (error) {
      if (get().selectedProjectId !== projectId) {
        return;
      }
      set({
        error: normalizeError(error, "恢复快照失败"),
      });
    } finally {
      if (get().selectedProjectId === projectId) {
        set({ restoringSnapshotId: null });
      }
    }
  },

  loadSnapshotDiff: async (snapshotId, againstSnapshotId) => {
    const projectId = get().selectedProjectId;
    if (!projectId) {
      set({ error: "请先选择项目" });
      return;
    }

    const query = new URLSearchParams();
    if (againstSnapshotId) {
      query.set("against", againstSnapshotId);
    }

    set({ loadingSnapshotDiff: true, error: null });
    try {
      const response = await fetch(
        `/api/projects/${projectId}/snapshots/${encodeURIComponent(snapshotId)}/diff${
          query.size > 0 ? `?${query.toString()}` : ""
        }`,
        {
          method: "GET",
        },
      );
      const json = await readJson<{ diff: ProjectSnapshotDiff }>(response);

      if (get().selectedProjectId !== projectId) {
        return;
      }

      set({
        snapshotDiff: json.data.diff,
        loadingSnapshotDiff: false,
      });
    } catch (error) {
      if (get().selectedProjectId !== projectId) {
        return;
      }
      set({
        loadingSnapshotDiff: false,
        error: normalizeError(error, "快照差异加载失败"),
      });
    }
  },

  clearSnapshotDiff: () => {
    set({ snapshotDiff: null });
  },

  clearImportFeedback: () => {
    set({ importResult: null, importErrorReport: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
