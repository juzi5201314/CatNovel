import { and, desc, eq } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import { chapters } from "@/db/schema";

import { BaseRepository } from "./base-repository";

export type ChapterRecord = {
  id: string;
  projectId: string;
  orderNo: number;
  title: string;
  content?: string;
  summary?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateChapterInput = {
  id: string;
  projectId: string;
  orderNo: number;
  title: string;
  content?: string;
  summary?: string | null;
};

export type ChapterPatch = Partial<
  Pick<ChapterRecord, "title" | "content" | "summary">
>;

export class ChaptersRepository extends BaseRepository {
  constructor(database?: AppDatabase) {
    super(database);
  }

  listByProject(projectId: string) {
    return this.db
      .select()
      .from(chapters)
      .where(eq(chapters.projectId, projectId))
      .orderBy(chapters.orderNo)
      .all();
  }

  findById(projectId: string, chapterId: string) {
    const row = this.db
      .select()
      .from(chapters)
      .where(and(eq(chapters.projectId, projectId), eq(chapters.id, chapterId)))
      .get();
    return row ?? null;
  }

  findByChapterId(chapterId: string): ChapterRecord | null {
    const row = this.db
      .select()
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .get();
    return row ?? null;
  }

  getNextOrderNo(projectId: string): number {
    const latest = this.db
      .select({ orderNo: chapters.orderNo })
      .from(chapters)
      .where(eq(chapters.projectId, projectId))
      .orderBy(desc(chapters.orderNo))
      .limit(1)
      .get();
    return (latest?.orderNo ?? 0) + 1;
  }

  create(input: CreateChapterInput): ChapterRecord {
    this.db
      .insert(chapters)
      .values({
        id: input.id,
        projectId: input.projectId,
        orderNo: input.orderNo,
        title: input.title,
        content: input.content ?? "",
        summary: input.summary ?? null,
      })
      .run();
    const created = this.findByChapterId(input.id);
    if (!created) {
      throw new Error("failed to create chapter");
    }
    return created;
  }

  createMany(inputs: CreateChapterInput[]): ChapterRecord[] {
    if (inputs.length === 0) {
      return [];
    }

    return this.transaction((tx) => {
      const repository = new ChaptersRepository(tx);
      const created: ChapterRecord[] = [];
      for (const input of inputs) {
        created.push(repository.create(input));
      }
      return created;
    });
  }

  update(chapterId: string, patch: ChapterPatch): boolean {
    if (Object.keys(patch).length === 0) {
      return false;
    }

    const result = this.db
      .update(chapters)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(chapters.id, chapterId))
      .run();
    return result.changes > 0;
  }

  updateAndGet(chapterId: string, patch: ChapterPatch): ChapterRecord | null {
    const updated = this.update(chapterId, patch);
    if (!updated) {
      return this.findByChapterId(chapterId);
    }
    return this.findByChapterId(chapterId);
  }
}
