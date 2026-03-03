import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { projects } from "@/db/schema/projects";

export const projectSettings = sqliteTable("project_settings", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  systemPrompt: text("system_prompt").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type ProjectSettingsRow = typeof projectSettings.$inferSelect;
export type NewProjectSettingsRow = typeof projectSettings.$inferInsert;

