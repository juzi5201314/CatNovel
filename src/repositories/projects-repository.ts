import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import { projects, type ProjectMode } from "@/db/schema";

import { BaseRepository } from "./base-repository";
import { ChaptersRepository, type ChapterRecord } from "./chapters-repository";

export type ProjectRecord = {
  id: string;
  name: string;
  mode: ProjectMode;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateProjectInput = {
  id: string;
  name: string;
  mode: ProjectMode;
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

export class ProjectsRepository extends BaseRepository {
  constructor(database?: AppDatabase) {
    super(database);
  }

  list(): ProjectRecord[] {
    return this.db.select().from(projects).orderBy(projects.createdAt).all();
  }

  findById(id: string): ProjectRecord | null {
    const row = this.db.select().from(projects).where(eq(projects.id, id)).get();
    return row ?? null;
  }

  create(input: CreateProjectInput): ProjectRecord {
    this.db.insert(projects).values(input).run();
    const created = this.findById(input.id);
    if (!created) {
      throw new Error("failed to create project");
    }
    return created;
  }

  updateName(id: string, name: string): boolean {
    const result = this.db
      .update(projects)
      .set({ name, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .run();
    return result.changes > 0;
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
