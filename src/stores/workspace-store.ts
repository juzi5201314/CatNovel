"use client";

import { create } from "zustand";

import type { ApiResponse, ApiSuccess, ChapterItem, ProjectItem, ProjectMode } from "@/components/workspace/types";

type SaveChapterPayload = {
  content: string;
  summary?: string | null;
};

type WorkspaceState = {
  projects: ProjectItem[];
  chapters: ChapterItem[];
  selectedProjectId: string | null;
  selectedChapterId: string | null;
  loadingProjects: boolean;
  loadingChapters: boolean;
  creatingProject: boolean;
  creatingChapter: boolean;
  savingChapter: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  createProject: (input: { name: string; mode: ProjectMode }) => Promise<void>;
  selectProject: (projectId: string | null) => Promise<void>;
  fetchChapters: (projectId: string) => Promise<void>;
  createChapter: (input: { title: string }) => Promise<void>;
  selectChapter: (chapterId: string | null) => void;
  saveChapter: (payload: SaveChapterPayload) => Promise<void>;
  clearError: () => void;
};

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
  const json = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !json.success) {
    throw new Error(json.success ? "request_failed" : json.error.message);
  }
  return json;
}

function pickInitialChapter(chapters: ChapterItem[]): string | null {
  return chapters.length > 0 ? chapters[0].id : null;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  projects: [],
  chapters: [],
  selectedProjectId: null,
  selectedChapterId: null,
  loadingProjects: false,
  loadingChapters: false,
  creatingProject: false,
  creatingChapter: false,
  savingChapter: false,
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
        await get().fetchChapters(selectedProjectId);
      } else {
        set({ chapters: [], selectedChapterId: null });
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
        selectedChapterId: null,
        creatingProject: false,
      });

      await get().fetchChapters(created.id);
    } catch (error) {
      set({
        creatingProject: false,
        error: normalizeError(error, "项目创建失败"),
      });
    }
  },

  selectProject: async (projectId) => {
    set({ selectedProjectId: projectId, selectedChapterId: null, error: null });
    if (!projectId) {
      set({ chapters: [] });
      return;
    }
    await get().fetchChapters(projectId);
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

      set({
        chapters,
        selectedChapterId,
        loadingChapters: false,
      });
    } catch (error) {
      set({
        loadingChapters: false,
        error: normalizeError(error, "章节加载失败"),
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
      const json = await readJson<ChapterItem>(response);
      const updated = json.data;
      const chapters = get().chapters.map((chapter) =>
        chapter.id === updated.id ? { ...chapter, ...updated } : chapter,
      );

      set({
        chapters,
        savingChapter: false,
      });
    } catch (error) {
      set({
        savingChapter: false,
        error: normalizeError(error, "章节保存失败"),
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
