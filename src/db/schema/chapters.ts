import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { projects } from "@/db/schema/projects";

export const chapters = sqliteTable(
  "chapters",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    summary: text("summary"),
    orderNo: integer("order").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    orderNonNegativeCheck: check("chapters_order_non_negative_check", sql`${table.orderNo} >= 0`),
    projectOrderIdx: index("chapters_project_order_idx").on(table.projectId, table.orderNo),
    projectUpdatedAtIdx: index("chapters_project_updated_at_idx").on(table.projectId, table.updatedAt),
  }),
);

export type ChapterRow = typeof chapters.$inferSelect;
export type NewChapterRow = typeof chapters.$inferInsert;
