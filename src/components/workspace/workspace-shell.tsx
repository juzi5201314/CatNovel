"use client";

import { useCallback, useEffect, useMemo } from "react";

import { RightSidebar } from "@/components/ai-sidebar/right-sidebar";
import { LeftSidebar } from "@/components/sidebar/left-sidebar";
import type { ChapterItem } from "@/components/workspace/types";
import { EditorShell } from "@/components/editor/editor-shell";
import { useWorkspaceStore } from "@/stores/workspace-store";

type EditorSavePayload = {
  content: string;
  summary?: string | null;
};

export function WorkspaceShell() {
  const projects = useWorkspaceStore((state) => state.projects);
  const chapters = useWorkspaceStore((state) => state.chapters);
  const selectedProjectId = useWorkspaceStore((state) => state.selectedProjectId);
  const selectedChapterId = useWorkspaceStore((state) => state.selectedChapterId);
  const loadingProjects = useWorkspaceStore((state) => state.loadingProjects);
  const loadingChapters = useWorkspaceStore((state) => state.loadingChapters);
  const creatingProject = useWorkspaceStore((state) => state.creatingProject);
  const creatingChapter = useWorkspaceStore((state) => state.creatingChapter);
  const savingChapter = useWorkspaceStore((state) => state.savingChapter);
  const error = useWorkspaceStore((state) => state.error);

  const fetchProjects = useWorkspaceStore((state) => state.fetchProjects);
  const createProject = useWorkspaceStore((state) => state.createProject);
  const selectProject = useWorkspaceStore((state) => state.selectProject);
  const createChapter = useWorkspaceStore((state) => state.createChapter);
  const selectChapter = useWorkspaceStore((state) => state.selectChapter);
  const saveChapter = useWorkspaceStore((state) => state.saveChapter);
  const clearError = useWorkspaceStore((state) => state.clearError);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedChapter = useMemo<ChapterItem | null>(
    () => chapters.find((chapter) => chapter.id === selectedChapterId) ?? null,
    [chapters, selectedChapterId],
  );

  const handleSave = useCallback(
    async (payload: EditorSavePayload) => {
      await saveChapter(payload);
    },
    [saveChapter],
  );

  const handleAcceptGhost = useCallback(
    async (ghostText: string) => {
      if (!selectedChapter) {
        return;
      }

      const current = selectedChapter.content ?? "";
      const separator = current.length > 0 && !current.endsWith("\n") ? "\n" : "";

      await saveChapter({
        content: `${current}${separator}${ghostText}`,
        summary: selectedChapter.summary ?? null,
      });
    },
    [saveChapter, selectedChapter],
  );

  return (
    <main className="cn-workspace">
      <LeftSidebar
        projects={projects}
        chapters={chapters}
        selectedProjectId={selectedProjectId}
        selectedChapterId={selectedChapterId}
        loadingProjects={loadingProjects}
        loadingChapters={loadingChapters}
        creatingProject={creatingProject}
        creatingChapter={creatingChapter}
        error={error}
        onCreateProject={createProject}
        onSelectProject={selectProject}
        onCreateChapter={createChapter}
        onSelectChapter={selectChapter}
        onClearError={clearError}
      />

      <section className="cn-column cn-column-editor">
        <header className="cn-column-header">
          <h2>Editor</h2>
          <span>{savingChapter ? "保存中..." : "已连接"}</span>
        </header>
        <EditorShell chapter={selectedChapter} onSave={handleSave} />
      </section>

      <RightSidebar
        project={selectedProject}
        chapter={selectedChapter}
        onAcceptGhost={handleAcceptGhost}
      />
    </main>
  );
}
