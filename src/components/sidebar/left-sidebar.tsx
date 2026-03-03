"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";

import type {
  ChapterItem,
  ImportErrorReport,
  ProjectImportResult,
  ProjectItem,
  ProjectMode,
} from "@/components/workspace/types";
import { Skeleton } from "@/components/ui/skeleton";

type LeftSidebarProps = {
  projects: ProjectItem[];
  chapters: ChapterItem[];
  selectedProjectId: string | null;
  selectedChapterId: string | null;
  loadingProjects: boolean;
  loadingChapters: boolean;
  creatingProject: boolean;
  creatingChapter: boolean;
  renamingProject: boolean;
  deletingProject: boolean;
  importingProject: boolean;
  exportingProject: boolean;
  importResult: ProjectImportResult | null;
  importErrorReport: ImportErrorReport | null;
  lastExportJson: string | null;
  error: string | null;
  onCreateProject: (input: { name: string; mode: ProjectMode }) => Promise<void>;
  onRenameProject: (input: { projectId: string; name: string }) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onSelectProject: (projectId: string | null) => Promise<void>;
  onCreateChapter: (input: { title: string }) => Promise<void>;
  onImportProjectFromJson: (rawJson: string) => Promise<void>;
  onExportSelectedProject: () => Promise<void>;
  onSelectChapter: (chapterId: string | null) => void;
  onClearImportFeedback: () => void;
  onClearError: () => void;
};

export function LeftSidebar({
  projects,
  chapters,
  selectedProjectId,
  selectedChapterId,
  loadingProjects,
  loadingChapters,
  creatingProject,
  creatingChapter,
  renamingProject,
  deletingProject,
  importingProject,
  exportingProject,
  importResult,
  importErrorReport,
  lastExportJson,
  error,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onSelectProject,
  onCreateChapter,
  onImportProjectFromJson,
  onExportSelectedProject,
  onSelectChapter,
  onClearImportFeedback,
  onClearError,
}: LeftSidebarProps) {
  const [showProjectSwitcher, setShowProjectSwitcher] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateChapter, setShowCreateChapter] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showRenameProject, setShowRenameProject] = useState(false);
  const [showDeleteProject, setShowDeleteProject] = useState(false);
  
  const [projectName, setProjectName] = useState("");
  const [projectMode, setProjectMode] = useState<ProjectMode>("webnovel");
  const [chapterTitle, setChapterTitle] = useState("");
  const [importJson, setImportJson] = useState("");
  const [renameProjectName, setRenameProjectName] = useState("");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  
  const hasProject = selectedProjectId !== null;

  const currentProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  async function handleCreateProject(e: FormEvent) {
    e.preventDefault();
    if (!projectName.trim()) return;
    await onCreateProject({ name: projectName.trim(), mode: projectMode });
    setProjectName("");
    setShowCreateProject(false);
  }

  async function handleCreateChapter(e: FormEvent) {
    e.preventDefault();
    if (!hasProject || !chapterTitle.trim()) return;
    await onCreateChapter({ title: chapterTitle.trim() });
    setChapterTitle("");
    setShowCreateChapter(false);
  }

  function handleOpenRenameProject() {
    if (!currentProject) {
      return;
    }
    setRenameProjectName(currentProject.name);
    setShowRenameProject(true);
  }

  async function handleRenameProject(e: FormEvent) {
    e.preventDefault();
    if (!currentProject || !renameProjectName.trim()) {
      return;
    }
    await onRenameProject({
      projectId: currentProject.id,
      name: renameProjectName.trim(),
    });
    setShowRenameProject(false);
  }

  async function handleDeleteProject() {
    if (!currentProject) {
      return;
    }
    await onDeleteProject(currentProject.id);
    setShowDeleteProject(false);
  }

  return (
    <aside className="flex flex-col h-full border-r border-border bg-background w-[var(--cn-sidebar-left)] fixed left-0 top-0 overflow-y-auto custom-scrollbar z-20">
      <div className="p-6 space-y-8">
        {/* Navigation & Brand */}
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tighter hover:opacity-80 transition-opacity">
            CatNovel
          </Link>
          <Link 
            href="/settings" 
            className="text-xs font-medium px-2 py-1 rounded border border-border bg-muted/50 hover:bg-muted transition-colors flex items-center gap-1.5 group"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            Settings
            <kbd className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 bg-background">S</kbd>
          </Link>
        </div>

        {/* Current Project Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              Active Project
              <kbd className="opacity-50">⌘ K</kbd>
            </h3>
            <div className="flex gap-1">
              <button 
                className="p-1 hover:bg-muted rounded-md transition-colors group"
                onClick={() => setShowCreateProject(!showCreateProject)}
                title="New Project (N)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
          </div>

          {showCreateProject && (
            <form onSubmit={handleCreateProject} className="cn-panel p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <input
                className="w-full text-xs"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project Name..."
                autoFocus
              />
              <select 
                className="w-full text-xs"
                value={projectMode}
                onChange={(e) => setProjectMode(e.target.value as ProjectMode)}
              >
                <option value="webnovel">Web Novel</option>
                <option value="literary">Literary</option>
                <option value="screenplay">Screenplay</option>
              </select>
              <div className="flex justify-end gap-2">
                <button type="button" className="text-xs px-2 py-1" onClick={() => setShowCreateProject(false)}>Cancel</button>
                <button type="submit" className="primary text-xs px-2 py-1" disabled={creatingProject}>
                  {creatingProject ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {loadingProjects ? (
              <div className="space-y-2">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : currentProject ? (
              <div className="cn-panel p-4 space-y-3 bg-muted/20 hover:bg-muted/30 transition-all group border-dashed overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold truncate flex-1 pr-2">{currentProject.name}</span>
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded opacity-70 uppercase font-bold tracking-tighter">{currentProject.mode}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setShowProjectSwitcher(true)}
                    className="min-w-0 flex-1 text-[9px] py-1.5 px-2 transition-all border border-border bg-background hover:bg-muted rounded font-bold shadow-sm flex items-center justify-center gap-1 uppercase tracking-wide"
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></svg>
                    Switch
                  </button>
                  <div className="flex items-center gap-1 overflow-hidden max-w-0 opacity-0 -translate-x-1 pointer-events-none transition-all duration-200 group-hover:max-w-20 group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto group-focus-within:max-w-20 group-focus-within:opacity-100 group-focus-within:translate-x-0 group-focus-within:pointer-events-auto">
                    <button
                      type="button"
                      onClick={handleOpenRenameProject}
                      className="h-7 w-7 shrink-0 inline-flex items-center justify-center transition-all border border-border bg-background hover:bg-muted rounded text-muted-foreground"
                      title="Rename Project"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteProject(true)}
                      className="h-7 w-7 shrink-0 inline-flex items-center justify-center transition-all border border-red-200 bg-background hover:bg-red-50 hover:border-red-300 text-red-600 rounded"
                      title="Delete Project"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center border border-dashed border-border rounded-lg bg-muted/5 group hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => setShowCreateProject(true)}>
                <div className="mx-auto w-12 h-12 mb-4 opacity-10 group-hover:opacity-30 transition-opacity">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <p className="text-xs text-muted-foreground mb-4 font-medium">Ready to start a new journey?</p>
                <button className="text-[10px] font-bold primary px-4 py-2 rounded-full uppercase tracking-widest">
                  Create Project
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Chapters Section */}
        {hasProject && (
          <section className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                Chapters
                <kbd className="opacity-50">C</kbd>
              </h3>
              <button 
                className="p-1 hover:bg-muted rounded-md transition-colors group"
                onClick={() => setShowCreateChapter(!showCreateChapter)}
                title="New Chapter (C)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>

            {showCreateChapter && (
              <form onSubmit={handleCreateChapter} className="cn-panel p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <input
                  className="w-full text-xs"
                  value={chapterTitle}
                  onChange={(e) => setChapterTitle(e.target.value)}
                  placeholder="Chapter Title..."
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button type="button" className="text-xs px-2 py-1" onClick={() => setShowCreateChapter(false)}>Cancel</button>
                  <button type="submit" className="primary text-xs px-2 py-1" disabled={creatingChapter}>
                    {creatingChapter ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-1">
              {loadingChapters ? (
                <div className="space-y-3 px-1">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : chapters.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-border rounded bg-muted/5">
                   <p className="text-[10px] text-muted-foreground italic font-medium">Add your first chapter</p>
                </div>
              ) : chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => onSelectChapter(chapter.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-all group flex items-center justify-between border ${
                    chapter.id === selectedChapterId 
                      ? "bg-accent text-accent-foreground font-bold shadow-md border-accent shadow-accent/20" 
                      : "hover:bg-muted text-muted-foreground hover:text-foreground border-transparent"
                  }`}
                >
                  <span className="truncate flex-1">
                    <span className={`mr-2 text-[10px] font-mono ${chapter.id === selectedChapterId ? 'text-white/60' : 'opacity-40'}`}>{String(chapter.orderNo).padStart(2, '0')}</span>
                    {chapter.title}
                  </span>
                  {chapter.id === selectedChapterId && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Footer Actions */}
        <section className="pt-8 border-t border-border space-y-2">
          <button 
            className="w-full text-left px-3 py-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center gap-2 group"
            onClick={() => setShowImportExport(!showImportExport)}
          >
            <svg className="group-hover:translate-y-0.5 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3"/></svg>
            Import / Export
          </button>
        </section>

        {/* Project Switcher Modal */}
        {showProjectSwitcher && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-300">
            <div className="bg-background rounded-xl border border-border shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[80vh] zoom-in-95 animate-in duration-200">
              <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-muted/10">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Select Workspace</h3>
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium uppercase tracking-wider">Switch between your active projects</p>
                </div>
                <button onClick={() => setShowProjectSwitcher(false)} className="p-1.5 hover:bg-muted rounded-full transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                <div className="space-y-1">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => {
                        onSelectProject(project.id);
                        setShowProjectSwitcher(false);
                      }}
                      className={`w-full text-left px-4 py-4 rounded-lg transition-all flex items-center justify-between border ${
                        project.id === selectedProjectId 
                          ? "bg-accent/5 border-accent/20 shadow-sm" 
                          : "hover:bg-muted border-transparent hover:border-border/50"
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        <span className={`text-sm ${project.id === selectedProjectId ? "font-bold text-accent" : "font-semibold"}`}>
                          {project.name}
                        </span>
                        <div className="flex gap-2">
                           <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded font-bold uppercase tracking-tight opacity-60">{project.mode}</span>
                        </div>
                      </div>
                      {project.id === selectedProjectId && (
                        <div className="bg-accent rounded-full p-1 shadow-lg shadow-accent/30">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><path d="M20 6 9 17l-5-5"/></svg>
                        </div>
                      )}
                    </button>
                  ))}
                  {projects.length === 0 && (
                    <div className="py-16 text-center text-muted-foreground text-sm italic font-medium">
                      No projects found.
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-border bg-muted/5 flex justify-end">
                <button 
                  className="primary text-[10px] px-5 py-2.5 rounded-full font-bold uppercase tracking-widest shadow-lg shadow-black/5" 
                  onClick={() => {
                    setShowProjectSwitcher(false);
                    setShowCreateProject(true);
                  }}
                >
                  Create New Workspace
                </button>
              </div>
            </div>
          </div>
        )}

        {showRenameProject && currentProject && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-300">
            <div className="bg-background rounded-xl border border-border shadow-2xl max-w-sm w-full p-6 space-y-5 zoom-in-95 animate-in duration-200">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Rename Project</h3>
                <p className="text-[10px] text-muted-foreground mt-1 font-medium uppercase tracking-wider">
                  Update display name for current workspace
                </p>
              </div>
              <form onSubmit={handleRenameProject} className="space-y-4">
                <input
                  className="w-full text-xs"
                  value={renameProjectName}
                  onChange={(e) => setRenameProjectName(e.target.value)}
                  placeholder="Project Name..."
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="text-xs px-3 py-1.5"
                    onClick={() => setShowRenameProject(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary text-xs px-3 py-1.5"
                    disabled={renamingProject || !renameProjectName.trim()}
                  >
                    {renamingProject ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showDeleteProject && currentProject && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-300">
            <div className="bg-background rounded-xl border border-border shadow-2xl max-w-sm w-full p-6 space-y-5 zoom-in-95 animate-in duration-200">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-red-600">Delete Project</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  This action will permanently remove <span className="font-semibold text-foreground">{currentProject.name}</span> and all related chapters, snapshots, and timeline records.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="text-xs px-3 py-1.5"
                  onClick={() => setShowDeleteProject(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-60"
                  onClick={() => {
                    void handleDeleteProject();
                  }}
                  disabled={deletingProject}
                >
                  {deletingProject ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import/Export Modal */}
        {showImportExport && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
            <div className="bg-background rounded-xl border border-border shadow-2xl max-w-lg w-full p-8 space-y-8 zoom-in-95 animate-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Data Management</h3>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">Migrate your project data using JSON format</p>
                </div>
                <button onClick={() => setShowImportExport(false)} className="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-full transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Exporting Content</label>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border flex items-start justify-between gap-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">Your project structure, chapters, snapshots, and AI settings will be packaged into a single JSON file.</p>
                    <button 
                      className="primary text-[10px] font-bold px-4 py-2.5 rounded shadow-lg shadow-black/5 whitespace-nowrap uppercase" 
                      onClick={() => onExportSelectedProject()} 
                      disabled={!hasProject || exportingProject}
                    >
                      {exportingProject ? "Working..." : "Pack JSON"}
                    </button>
                  </div>
                  {lastExportJson && (
                    <div className="flex justify-end">
                      <button className="text-[10px] font-bold text-accent hover:underline flex items-center gap-1" onClick={() => {
                        navigator.clipboard.writeText(lastExportJson);
                        setCopyMessage("Copied!");
                        setTimeout(() => setCopyMessage(null), 2000);
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        {copyMessage || "Copy Result to Clipboard"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-4 border-t border-border">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Importing Workspace</label>
                  <textarea
                    className="w-full min-h-[160px] text-xs font-mono p-4 bg-muted/20 focus:bg-background transition-all rounded-lg border border-border outline-none focus:ring-2 ring-accent/20"
                    placeholder='{"id": "...", "name": "...", ...}'
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <button 
                      className="primary flex-1 text-[10px] font-bold py-3 rounded uppercase tracking-widest shadow-lg shadow-black/5"
                      onClick={() => onImportProjectFromJson(importJson)}
                      disabled={importingProject || !importJson.trim()}
                    >
                      {importingProject ? "Importing Data..." : "Deploy Workspace"}
                    </button>
                    {lastExportJson && (
                      <button 
                        type="button"
                        className="text-[10px] font-bold px-4 border border-border rounded hover:bg-muted transition-colors uppercase tracking-widest"
                        onClick={() => setImportJson(lastExportJson)}
                      >
                        Restore Last
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs relative animate-in zoom-in shadow-xl shadow-red-900/5">
            <button className="absolute top-3 right-3 opacity-40 hover:opacity-100 transition-opacity font-bold" onClick={onClearError}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
            <p className="font-black uppercase tracking-tighter mb-1.5 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Critical Alert
            </p>
            <p className="font-medium leading-relaxed opacity-90">{error}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
