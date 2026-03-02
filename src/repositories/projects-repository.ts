import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import { projects, type ProjectMode } from "@/db/schema";

import { BaseRepository } from "./base-repository";

export type ProjectRecord = {
  id: string;
  name: string;
  mode: ProjectMode;
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

  create(input: ProjectRecord): ProjectRecord {
    this.db.insert(projects).values(input).run();
    return input;
  }

  updateName(id: string, name: string): boolean {
    const result = this.db
      .update(projects)
      .set({ name, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .run();
    return result.changes > 0;
  }
}
