import { and, eq } from "drizzle-orm";

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

  create(input: ChapterRecord): ChapterRecord {
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
    return {
      ...input,
      content: input.content ?? "",
      summary: input.summary ?? null,
    };
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
}
