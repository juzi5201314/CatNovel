import { eq, inArray } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import { projectSettings } from "@/db/schema";

import { BaseRepository } from "./base-repository";

export type ProjectSettingsRecord = {
  projectId: string;
  systemPrompt: string;
  createdAt: Date;
  updatedAt: Date;
};

export class ProjectSettingsRepository extends BaseRepository {
  constructor(database?: AppDatabase) {
    super(database);
  }

  getByProjectId(projectId: string): ProjectSettingsRecord | null {
    const row = this.db
      .select()
      .from(projectSettings)
      .where(eq(projectSettings.projectId, projectId))
      .get();
    return row ?? null;
  }

  listByProjectIds(projectIds: string[]): ProjectSettingsRecord[] {
    if (projectIds.length === 0) {
      return [];
    }

    return this.db
      .select()
      .from(projectSettings)
      .where(inArray(projectSettings.projectId, projectIds))
      .all();
  }

  upsert(input: { projectId: string; systemPrompt: string }): ProjectSettingsRecord {
    this.db
      .insert(projectSettings)
      .values({
        projectId: input.projectId,
        systemPrompt: input.systemPrompt,
      })
      .onConflictDoUpdate({
        target: projectSettings.projectId,
        set: {
          systemPrompt: input.systemPrompt,
          updatedAt: new Date(),
        },
      })
      .run();

    const row = this.getByProjectId(input.projectId);
    if (!row) {
      throw new Error("failed to upsert project settings");
    }
    return row;
  }
}

