import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import { projects, type ProjectMode, type ProjectRow } from "@/db/schema";
import { resolveInitialDefaultSelection } from "@/core/llm/initial-default-selection";
import { DEFAULT_WRITING_SYSTEM_PROMPT } from "@/core/llm/default-prompts";

import { BaseRepository } from "./base-repository";
import { ChaptersRepository, type ChapterRecord } from "./chapters-repository";
import { LlmDefaultSelectionRepository } from "./llm-default-selection-repository";
import { LlmModelPresetsRepository } from "./llm-model-presets-repository";
import { LlmProvidersRepository } from "./llm-providers-repository";
import { ProjectSettingsRepository } from "./project-settings-repository";

export type ProjectRecord = {
  id: string;
  name: string;
  mode: ProjectMode;
  systemPrompt: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateProjectInput = {
  id: string;
  name: string;
  mode: ProjectMode;
  systemPrompt?: string;
};

export type ImportProjectChapterInput = {
  id?: string;
  orderNo: number;
  title: string;
  content: string;
  summary?: string | null;
};

export type ImportProjectBundleInput = {
  project: CreateProjectInput;
  chapters: ImportProjectChapterInput[];
};

export type UpdateProjectSettingsInput = {
  name?: string;
  systemPrompt?: string;
};

function normalizeSystemPrompt(prompt?: string): string {
  const value = prompt?.trim();
  if (!value) {
    return DEFAULT_WRITING_SYSTEM_PROMPT;
  }
  return value;
}

export class ProjectsRepository extends BaseRepository {
  constructor(database?: AppDatabase) {
    super(database);
  }

  private mapProjectRows(rows: ProjectRow[]): ProjectRecord[] {
    if (rows.length === 0) {
      return [];
    }

    const settingsRepository = new ProjectSettingsRepository(this.db);
    const settings = settingsRepository.listByProjectIds(rows.map((row) => row.id));
    const settingsMap = new Map(settings.map((row) => [row.projectId, row]));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      mode: row.mode,
      systemPrompt:
        settingsMap.get(row.id)?.systemPrompt ?? DEFAULT_WRITING_SYSTEM_PROMPT,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  list(): ProjectRecord[] {
    const rows = this.db.select().from(projects).orderBy(projects.createdAt).all();
    return this.mapProjectRows(rows);
  }

  findById(id: string): ProjectRecord | null {
    const row = this.db.select().from(projects).where(eq(projects.id, id)).get();
    if (!row) {
      return null;
    }
    return this.mapProjectRows([row])[0] ?? null;
  }

  create(input: CreateProjectInput): ProjectRecord {
    this.db
      .insert(projects)
      .values({
        id: input.id,
        name: input.name,
        mode: input.mode,
      })
      .run();
    const projectSettingsRepository = new ProjectSettingsRepository(this.db);
    projectSettingsRepository.upsert({
      projectId: input.id,
      systemPrompt: normalizeSystemPrompt(input.systemPrompt),
    });

    const modelPresetsRepository = new LlmModelPresetsRepository(this.db);
    const providersRepository = new LlmProvidersRepository(this.db);
    const defaultSelectionRepository = new LlmDefaultSelectionRepository(this.db);
    const defaults = resolveInitialDefaultSelection(
      modelPresetsRepository.list(),
      providersRepository.list(),
    );
    defaultSelectionRepository.upsert({
      projectId: input.id,
      defaultChatPresetId: defaults.defaultChatPresetId,
      defaultEmbeddingPresetId: defaults.defaultEmbeddingPresetId,
    });

    const created = this.findById(input.id);
    if (!created) {
      throw new Error("failed to create project");
    }
    return created;
  }

  updateSettings(id: string, input: UpdateProjectSettingsInput): boolean {
    return this.transaction((tx) => {
      const repository = new ProjectsRepository(tx);
      let changed = false;

      if (typeof input.name === "string") {
        const result = tx
          .update(projects)
          .set({ name: input.name, updatedAt: new Date() })
          .where(eq(projects.id, id))
          .run();
        changed = changed || result.changes > 0;
      }

      if (typeof input.systemPrompt === "string") {
        const settingsRepository = new ProjectSettingsRepository(tx);
        settingsRepository.upsert({
          projectId: id,
          systemPrompt: normalizeSystemPrompt(input.systemPrompt),
        });
        changed = true;
      }

      if (!changed) {
        const existing = repository.findById(id);
        return existing !== null;
      }

      return true;
    });
  }

  deleteById(id: string): boolean {
    const result = this.db.delete(projects).where(eq(projects.id, id)).run();
    return result.changes > 0;
  }

  importProjectBundle(input: ImportProjectBundleInput): {
    project: ProjectRecord;
    chapters: ChapterRecord[];
  } {
    return this.transaction((tx) => {
      const projectsRepository = new ProjectsRepository(tx);
      const chaptersRepository = new ChaptersRepository(tx);

      const project = projectsRepository.create(input.project);
      const chapters = input.chapters.map((chapter) =>
        chaptersRepository.create({
          id: chapter.id ?? crypto.randomUUID(),
          projectId: project.id,
          orderNo: chapter.orderNo,
          title: chapter.title,
          content: chapter.content,
          summary: chapter.summary ?? null,
        }),
      );

      return { project, chapters };
    });
  }
}
