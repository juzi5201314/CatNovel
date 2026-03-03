"use client";

import { useCallback, useEffect, useMemo } from "react";

import { RightSidebar } from "@/components/ai-sidebar/right-sidebar";
import { LeftSidebar } from "@/components/sidebar/left-sidebar";
import type { ChapterItem } from "@/components/workspace/types";
import { EditorShell } from "@/components/editor/editor-shell";
import { useWorkspaceStore } from "@/stores/workspace-store";

type EditorSavePayload = {
  content: string;
  summary?: string;
};

export function WorkspaceShell() {
  const projects = useWorkspaceStore((state) => state.projects);
  const chapters = useWorkspaceStore((state) => state.chapters);
  const selectedProjectId = useWorkspaceStore((state) => state.selectedProjectId);
  const selectedChapterId = useWorkspaceStore((state) => state.selectedChapterId);
  const loadingProjects = useWorkspaceStore((state) => state.loadingProjects);
  const loadingChapters = useWorkspaceStore((state) => state.loadingChapters);
  const creatingProject = useWorkspaceStore((state) => state.creatingProject);
  const renamingProject = useWorkspaceStore((state) => state.renamingProject);
  const deletingProject = useWorkspaceStore((state) => state.deletingProject);
  const creatingChapter = useWorkspaceStore((state) => state.creatingChapter);
  const savingChapter = useWorkspaceStore((state) => state.savingChapter);
  const importingProject = useWorkspaceStore((state) => state.importingProject);
  const exportingProject = useWorkspaceStore((state) => state.exportingProject);
  const importResult = useWorkspaceStore((state) => state.importResult);
  const importErrorReport = useWorkspaceStore((state) => state.importErrorReport);
  const lastExportJson = useWorkspaceStore((state) => state.lastExportJson);
  const snapshots = useWorkspaceStore((state) => state.snapshots);
  const snapshotDiff = useWorkspaceStore((state) => state.snapshotDiff);
  const snapshotRestoreResult = useWorkspaceStore((state) => state.snapshotRestoreResult);
  const loadingSnapshots = useWorkspaceStore((state) => state.loadingSnapshots);
  const creatingSnapshot = useWorkspaceStore((state) => state.creatingSnapshot);
  const loadingSnapshotDiff = useWorkspaceStore((state) => state.loadingSnapshotDiff);
  const restoringSnapshotId = useWorkspaceStore((state) => state.restoringSnapshotId);
  const error = useWorkspaceStore((state) => state.error);

  const fetchProjects = useWorkspaceStore((state) => state.fetchProjects);
  const createProject = useWorkspaceStore((state) => state.createProject);
  const updateProjectSettings = useWorkspaceStore((state) => state.updateProjectSettings);
  const deleteProject = useWorkspaceStore((state) => state.deleteProject);
  const selectProject = useWorkspaceStore((state) => state.selectProject);
  const createChapter = useWorkspaceStore((state) => state.createChapter);
  const selectChapter = useWorkspaceStore((state) => state.selectChapter);
  const saveChapter = useWorkspaceStore((state) => state.saveChapter);
  const importProjectFromJson = useWorkspaceStore((state) => state.importProjectFromJson);
  const exportSelectedProject = useWorkspaceStore((state) => state.exportSelectedProject);
  const fetchSnapshots = useWorkspaceStore((state) => state.fetchSnapshots);
  const createManualSnapshot = useWorkspaceStore((state) => state.createManualSnapshot);
  const restoreSnapshot = useWorkspaceStore((state) => state.restoreSnapshot);
  const loadSnapshotDiff = useWorkspaceStore((state) => state.loadSnapshotDiff);
  const clearSnapshotDiff = useWorkspaceStore((state) => state.clearSnapshotDiff);
  const clearImportFeedback = useWorkspaceStore((state) => state.clearImportFeedback);
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
      const payload: EditorSavePayload = {
        content: `${current}${separator}${ghostText}`,
      };
      if (typeof selectedChapter.summary === "string") {
        payload.summary = selectedChapter.summary;
      }

      await saveChapter(payload);
    },
    [saveChapter, selectedChapter],
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground overflow-hidden">
      <LeftSidebar
        projects={projects}
        chapters={chapters}
        selectedProjectId={selectedProjectId}
        selectedChapterId={selectedChapterId}
        loadingProjects={loadingProjects}
        loadingChapters={loadingChapters}
        creatingProject={creatingProject}
        renamingProject={renamingProject}
        deletingProject={deletingProject}
        creatingChapter={creatingChapter}
        importingProject={importingProject}
        exportingProject={exportingProject}
        importResult={importResult}
        importErrorReport={importErrorReport}
        lastExportJson={lastExportJson}
        error={error}
        onCreateProject={createProject}
        onUpdateProjectSettings={updateProjectSettings}
        onDeleteProject={deleteProject}
        onSelectProject={selectProject}
        onCreateChapter={createChapter}
        onImportProjectFromJson={importProjectFromJson}
        onExportSelectedProject={exportSelectedProject}
        onSelectChapter={selectChapter}
        onClearImportFeedback={clearImportFeedback}
        onClearError={clearError}
      />

      <main className="flex-1 ml-[var(--cn-sidebar-left)] mr-[var(--cn-sidebar-right)] min-w-0 h-screen overflow-hidden flex flex-col">
        <EditorShell chapter={selectedChapter} onSave={handleSave} />
      </main>

      <RightSidebar
        project={selectedProject}
        chapter={selectedChapter}
        snapshots={snapshots}
        snapshotDiff={snapshotDiff}
        snapshotRestoreResult={snapshotRestoreResult}
        loadingSnapshots={loadingSnapshots}
        creatingSnapshot={creatingSnapshot}
        loadingSnapshotDiff={loadingSnapshotDiff}
        restoringSnapshotId={restoringSnapshotId}
        onAcceptGhost={handleAcceptGhost}
        onRefreshSnapshots={async () => {
          if (!selectedProject?.id) {
            return;
          }
          await fetchSnapshots(selectedProject.id);
        }}
        onCreateSnapshot={createManualSnapshot}
        onRestoreSnapshot={restoreSnapshot}
        onLoadSnapshotDiff={loadSnapshotDiff}
        onClearSnapshotDiff={clearSnapshotDiff}
      />
    </div>
  );
}
