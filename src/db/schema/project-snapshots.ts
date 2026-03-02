import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { chapters } from "@/db/schema/chapters";
import { projects } from "@/db/schema/projects";

export const PROJECT_SNAPSHOT_TRIGGER_TYPES = ["auto", "manual", "restore"] as const;
export type ProjectSnapshotTriggerType = (typeof PROJECT_SNAPSHOT_TRIGGER_TYPES)[number];

export const projectSnapshots = sqliteTable(
  "project_snapshots",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceChapterId: text("source_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    sourceSnapshotId: text("source_snapshot_id"),
    triggerType: text("trigger_type", { enum: PROJECT_SNAPSHOT_TRIGGER_TYPES })
      .$type<ProjectSnapshotTriggerType>()
      .notNull(),
    triggerReason: text("trigger_reason").notNull(),
    chapterCount: integer("chapter_count").notNull(),
    timelineEventCount: integer("timeline_event_count").notNull(),
    timelineSummary: text("timeline_summary").notNull(),
    payload: text("payload").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    triggerReasonLengthCheck: check(
      "project_snapshots_trigger_reason_length_check",
      sql`length(${table.triggerReason}) >= 1`,
    ),
    chapterCountNonNegativeCheck: check(
      "project_snapshots_chapter_count_non_negative_check",
      sql`${table.chapterCount} >= 0`,
    ),
    timelineEventCountNonNegativeCheck: check(
      "project_snapshots_timeline_event_count_non_negative_check",
      sql`${table.timelineEventCount} >= 0`,
    ),
    projectCreatedAtIdx: index("project_snapshots_project_created_at_idx").on(
      table.projectId,
      table.createdAt,
    ),
    projectTriggerTypeIdx: index("project_snapshots_project_trigger_type_idx").on(
      table.projectId,
      table.triggerType,
    ),
    sourceChapterIdIdx: index("project_snapshots_source_chapter_id_idx").on(table.sourceChapterId),
    sourceSnapshotIdIdx: index("project_snapshots_source_snapshot_id_idx").on(table.sourceSnapshotId),
  }),
);

export type ProjectSnapshotRow = typeof projectSnapshots.$inferSelect;
export type NewProjectSnapshotRow = typeof projectSnapshots.$inferInsert;
