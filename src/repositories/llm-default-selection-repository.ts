import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import { llmDefaultSelection } from "@/db/schema";

import { BaseRepository } from "./base-repository";

export type LlmDefaultSelectionRecord = {
  projectId: string;
  defaultChatPresetId?: string | null;
  defaultEmbeddingPresetId?: string | null;
};

export class LlmDefaultSelectionRepository extends BaseRepository {
  constructor(database?: AppDatabase) {
    super(database);
  }

  getByProjectId(projectId: string) {
    const row = this.db
      .select()
      .from(llmDefaultSelection)
      .where(eq(llmDefaultSelection.projectId, projectId))
      .get();
    return row ?? null;
  }

  upsert(record: LlmDefaultSelectionRecord): LlmDefaultSelectionRecord {
    this.db
      .insert(llmDefaultSelection)
      .values({
        projectId: record.projectId,
        defaultChatPresetId: record.defaultChatPresetId ?? null,
        defaultEmbeddingPresetId: record.defaultEmbeddingPresetId ?? null,
      })
      .onConflictDoUpdate({
        target: llmDefaultSelection.projectId,
        set: {
          defaultChatPresetId: record.defaultChatPresetId ?? null,
          defaultEmbeddingPresetId: record.defaultEmbeddingPresetId ?? null,
          updatedAt: new Date(),
        },
      })
      .run();

    return {
      projectId: record.projectId,
      defaultChatPresetId: record.defaultChatPresetId ?? null,
      defaultEmbeddingPresetId: record.defaultEmbeddingPresetId ?? null,
    };
  }
}
