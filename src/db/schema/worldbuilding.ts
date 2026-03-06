import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { projects } from "@/db/schema/projects";

export const worldbuildingNodes = sqliteTable(
  "worldbuilding_nodes",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    nameLengthCheck: check(
      "wb_nodes_name_length_check",
      sql`length(${table.name}) >= 1`,
    ),
    projectIdx: index("wb_nodes_project_idx").on(table.projectId),
    parentIdx: index("wb_nodes_parent_idx").on(table.parentId),
    projectParentSortIdx: index("wb_nodes_project_parent_sort_idx").on(
      table.projectId,
      table.parentId,
      table.sortOrder,
    ),
  }),
);

export type WorldbuildingNodeRow = typeof worldbuildingNodes.$inferSelect;
export type NewWorldbuildingNodeRow = typeof worldbuildingNodes.$inferInsert;
