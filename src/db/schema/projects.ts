import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const PROJECT_MODES = ["webnovel", "literary", "screenplay"] as const;
export type ProjectMode = (typeof PROJECT_MODES)[number];

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    mode: text("mode", { enum: PROJECT_MODES }).$type<ProjectMode>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    nameLengthCheck: check("projects_name_length_check", sql`length(${table.name}) >= 1`),
    updatedAtIdx: index("projects_updated_at_idx").on(table.updatedAt),
  }),
);

export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
