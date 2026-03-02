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

type LeftSidebarProps = {
  projects: ProjectItem[];
  chapters: ChapterItem[];
  selectedProjectId: string | null;
  selectedChapterId: string | null;
  loadingProjects: boolean;
  loadingChapters: boolean;
  creatingProject: boolean;
  creatingChapter: boolean;
  importingProject: boolean;
  exportingProject: boolean;
  importResult: ProjectImportResult | null;
  importErrorReport: ImportErrorReport | null;
  lastExportJson: string | null;
  error: string | null;
  onCreateProject: (input: { name: string; mode: ProjectMode }) => Promise<void>;
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
  importingProject,
  exportingProject,
  importResult,
  importErrorReport,
  lastExportJson,
  error,
  onCreateProject,
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
  
  const [projectName, setProjectName] = useState("");
  const [projectMode, setProjectMode] = useState<ProjectMode>("webnovel");
  const [chapterTitle, setChapterTitle] = useState("");
  const [importJson, setImportJson] = useState("");
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

  return (
    <aside className="flex flex-col h-full border-r border-border bg-background w-[var(--cn-sidebar-left)] fixed left-0 top-0 overflow-y-auto">
      <div className="p-6 space-y-8">
        {/* Navigation & Brand */}
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tighter hover:opacity-80 transition-opacity">
            CatNovel
          </Link>
          <Link 
            href="/settings" 
            className="text-xs font-medium px-2 py-1 rounded border border-border bg-muted/50 hover:bg-muted transition-colors flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            Settings
          </Link>
        </div>

        {/* Current Project Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Project</h3>
            <div className="flex gap-1">
              <button 
                className="p-1 hover:bg-muted rounded-md transition-colors"
                onClick={() => setShowCreateProject(!showCreateProject)}
                title="New Project"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
          </div>

          {showCreateProject && (
            <form onSubmit={handleCreateProject} className="cn-panel p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
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
                onChange={(e) => setProjectMode(e.target.value as any)}
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
            {currentProject ? (
              <div className="cn-panel p-4 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold truncate flex-1 pr-2">{currentProject.name}</span>
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded opacity-70 uppercase font-bold">{currentProject.mode}</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowProjectSwitcher(true)}
                    className="flex-1 text-[10px] py-1 transition-all border border-border bg-background hover:bg-muted rounded font-medium"
                  >
                    Switch
                  </button>
                  <button 
                    className="text-[10px] px-2 py-1 transition-all border border-border bg-background hover:bg-muted rounded font-medium opacity-50 cursor-not-allowed"
                    title="Rename (Coming Soon)"
                  >
                    Rename
                  </button>
                  <button 
                    className="text-[10px] px-2 py-1 transition-all border border-red-100 bg-background hover:bg-red-50 text-red-600 rounded font-medium opacity-50 cursor-not-allowed"
                    title="Delete (Coming Soon)"
                  >
                    Del
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center border border-dashed border-border rounded-lg">
                <p className="text-xs text-muted-foreground mb-3">No active project</p>
                <button 
                  onClick={() => setShowProjectSwitcher(true)}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Browse Projects
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Chapters Section */}
        {hasProject && (
          <section className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chapters</h3>
              <button 
                className="p-1 hover:bg-muted rounded-md transition-colors"
                onClick={() => setShowCreateChapter(!showCreateChapter)}
                title="New Chapter"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>

            {showCreateChapter && (
              <form onSubmit={handleCreateChapter} className="cn-panel p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
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
                <p className="text-xs text-muted-foreground animate-pulse">Loading chapters...</p>
              ) : chapters.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-3 py-2 border border-dashed border-border rounded">No chapters yet.</p>
              ) : chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => onSelectChapter(chapter.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all group flex items-center justify-between ${
                    chapter.id === selectedChapterId 
                      ? "bg-accent/10 text-accent font-medium" 
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="truncate flex-1">
                    <span className="opacity-50 mr-2 text-[10px] font-mono">{String(chapter.orderNo).padStart(2, '0')}</span>
                    {chapter.title}
                  </span>
                  {chapter.id === selectedChapterId && (
                    <div className="h-1 w-1 rounded-full bg-accent" />
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Footer Actions */}
        <section className="pt-8 border-t border-border space-y-2">
          <button 
            className="w-full text-left px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center gap-2 group"
            onClick={() => setShowImportExport(!showImportExport)}
          >
            <svg className="group-hover:translate-y-0.5 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3"/></svg>
            Import / Export
          </button>
        </section>

        {/* Project Switcher Modal */}
        {showProjectSwitcher && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-background rounded-lg border border-border shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[80vh]">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/10">
                <div>
                  <h3 className="text-sm font-semibold">Switch Project</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Select a project to load its workspace.</p>
                </div>
                <button onClick={() => setShowProjectSwitcher(false)} className="p-1 hover:bg-muted rounded-full transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <div className="space-y-1">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => {
                        onSelectProject(project.id);
                        setShowProjectSwitcher(false);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-md transition-all flex items-center justify-between ${
                        project.id === selectedProjectId 
                          ? "bg-accent/10 border border-accent/20" 
                          : "hover:bg-muted border border-transparent"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className={`text-sm ${project.id === selectedProjectId ? "font-bold text-accent" : "font-medium"}`}>
                          {project.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground opacity-60 uppercase">{project.mode}</span>
                      </div>
                      {project.id === selectedProjectId && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-accent"><path d="M20 6 9 17l-5-5"/></svg>
                      )}
                    </button>
                  ))}
                  {projects.length === 0 && (
                    <div className="py-12 text-center text-muted-foreground text-sm italic">
                      No projects found.
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-border bg-muted/5 flex justify-end">
                <button 
                  className="primary text-xs px-4 py-2" 
                  onClick={() => {
                    setShowProjectSwitcher(false);
                    setShowCreateProject(true);
                  }}
                >
                  New Project
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import/Export Modal (Same as before but consistent styling) */}
        {showImportExport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-background rounded-lg border border-border shadow-xl max-w-lg w-full p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight">Data Management</h3>
                <button onClick={() => setShowImportExport(false)} className="text-muted-foreground hover:text-foreground">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Export Project</label>
                  <p className="text-xs text-muted-foreground leading-relaxed">Download your project configuration, chapters, and history as a JSON file.</p>
                  <div className="flex gap-2">
                    <button 
                      className="primary text-xs font-bold" 
                      onClick={() => onExportSelectedProject()} 
                      disabled={!hasProject || exportingProject}
                    >
                      {exportingProject ? "Exporting..." : "Generate JSON"}
                    </button>
                    {lastExportJson && (
                      <button className="text-xs border-accent text-accent hover:bg-accent/5" onClick={() => {
                        navigator.clipboard.writeText(lastExportJson);
                        setCopyMessage("Copied!");
                        setTimeout(() => setCopyMessage(null), 2000);
                      }}>
                        {copyMessage || "Copy to Clipboard"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-6 border-t border-border">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Import Data</label>
                  <textarea
                    className="w-full min-h-[140px] text-xs font-mono p-3 bg-muted/30 focus:bg-background transition-colors rounded-md border border-border"
                    placeholder="Paste project JSON data here..."
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button 
                      className="primary w-full text-xs font-bold"
                      onClick={() => onImportProjectFromJson(importJson)}
                      disabled={importingProject || !importJson.trim()}
                    >
                      {importingProject ? "Processing..." : "Run Import"}
                    </button>
                    {lastExportJson && (
                      <button 
                        type="button"
                        className="text-xs whitespace-nowrap"
                        onClick={() => setImportJson(lastExportJson)}
                      >
                        Fill Last Export
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-md text-xs relative animate-in zoom-in shadow-sm">
            <button className="absolute top-2 right-2 opacity-50 hover:opacity-100" onClick={onClearError}>×</button>
            <p className="font-bold mb-1">Attention</p>
            {error}
          </div>
        )}
      </div>
    </aside>
  );
}
