"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";

import type { ChapterItem, ProjectItem, ProjectMode } from "@/components/workspace/types";

type LeftSidebarProps = {
  projects: ProjectItem[];
  chapters: ChapterItem[];
  selectedProjectId: string | null;
  selectedChapterId: string | null;
  loadingProjects: boolean;
  loadingChapters: boolean;
  creatingProject: boolean;
  creatingChapter: boolean;
  error: string | null;
  onCreateProject: (input: { name: string; mode: ProjectMode }) => Promise<void>;
  onSelectProject: (projectId: string | null) => Promise<void>;
  onCreateChapter: (input: { title: string }) => Promise<void>;
  onSelectChapter: (chapterId: string | null) => void;
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
  error,
  onCreateProject,
  onSelectProject,
  onCreateChapter,
  onSelectChapter,
  onClearError,
}: LeftSidebarProps) {
  const [projectName, setProjectName] = useState("");
  const [projectMode, setProjectMode] = useState<ProjectMode>("webnovel");
  const [chapterTitle, setChapterTitle] = useState("");
  const hasProject = selectedProjectId !== null;

  const currentProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (projectName.trim().length === 0) {
      return;
    }
    await onCreateProject({ name: projectName.trim(), mode: projectMode });
    setProjectName("");
  }

  async function handleCreateChapter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasProject || chapterTitle.trim().length === 0) {
      return;
    }
    await onCreateChapter({ title: chapterTitle.trim() });
    setChapterTitle("");
  }

  return (
    <section className="cn-column cn-column-left">
      <header className="cn-column-header">
        <h2>Project</h2>
        <span>{projects.length} 项</span>
      </header>

      <article className="cn-panel">
        <h3 className="cn-card-title">新建项目</h3>
        <form onSubmit={handleCreateProject}>
          <label>
            <span className="cn-card-description">项目名</span>
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="例如：暮色之海"
            />
          </label>
          <label>
            <span className="cn-card-description">模式</span>
            <select
              value={projectMode}
              onChange={(event) => setProjectMode(event.target.value as ProjectMode)}
            >
              <option value="webnovel">webnovel</option>
              <option value="literary">literary</option>
              <option value="screenplay">screenplay</option>
            </select>
          </label>
          <button type="submit" disabled={creatingProject}>
            {creatingProject ? "创建中..." : "创建项目"}
          </button>
        </form>
      </article>

      <article className="cn-panel">
        <h3 className="cn-card-title">项目列表</h3>
        <p className="cn-card-description">
          <Link href="/settings">打开设置页</Link>
        </p>
        {loadingProjects ? <p className="cn-card-description">加载中...</p> : null}
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                onClick={() => onSelectProject(project.id)}
                aria-current={project.id === selectedProjectId}
              >
                {project.name}
              </button>
            </li>
          ))}
        </ul>
      </article>

      <article className="cn-panel">
        <h3 className="cn-card-title">章节</h3>
        <p className="cn-card-description">
          {currentProject ? `当前项目：${currentProject.name}` : "请先选择项目"}
        </p>
        <form onSubmit={handleCreateChapter}>
          <label>
            <span className="cn-card-description">章节标题</span>
            <input
              value={chapterTitle}
              onChange={(event) => setChapterTitle(event.target.value)}
              placeholder="例如：第一章 雨夜"
              disabled={!hasProject}
            />
          </label>
          <button type="submit" disabled={!hasProject || creatingChapter}>
            {creatingChapter ? "创建中..." : "创建章节"}
          </button>
        </form>
        {loadingChapters ? <p className="cn-card-description">章节加载中...</p> : null}
        <ul>
          {chapters.map((chapter) => (
            <li key={chapter.id}>
              <button
                type="button"
                onClick={() => onSelectChapter(chapter.id)}
                aria-current={chapter.id === selectedChapterId}
              >
                {chapter.orderNo}. {chapter.title}
              </button>
            </li>
          ))}
        </ul>
      </article>

      {error ? (
        <article className="cn-panel">
          <h3 className="cn-card-title">状态反馈</h3>
          <p className="cn-card-description">{error}</p>
          <button type="button" onClick={onClearError}>
            关闭
          </button>
        </article>
      ) : null}
    </section>
  );
}
