import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { chapters } from "@/db/schema/chapters";
import { projects } from "@/db/schema/projects";

export const TIMELINE_ENTITY_TYPES = [
  "character",
  "location",
  "item",
  "organization",
  "concept",
  "other",
] as const;
export const TIMELINE_EVENT_STATUSES = [
  "auto",
  "confirmed",
  "rejected",
  "pending_review",
] as const;
export const TIMELINE_SNAPSHOT_TYPES = ["event_upsert", "chapter_rebuild"] as const;

export type TimelineEntityType = (typeof TIMELINE_ENTITY_TYPES)[number];
export type TimelineEventStatus = (typeof TIMELINE_EVENT_STATUSES)[number];
export type TimelineSnapshotType = (typeof TIMELINE_SNAPSHOT_TYPES)[number];

export const entities = sqliteTable(
  "entities",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    type: text("type", { enum: TIMELINE_ENTITY_TYPES }).$type<TimelineEntityType>().notNull(),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    nameLengthCheck: check("entities_name_length_check", sql`length(${table.name}) >= 1`),
    normalizedNameLengthCheck: check(
      "entities_normalized_name_length_check",
      sql`length(${table.normalizedName}) >= 1`,
    ),
    projectNormalizedNameUniqueIdx: uniqueIndex("entities_project_normalized_name_uidx").on(
      table.projectId,
      table.normalizedName,
    ),
    projectTypeIdx: index("entities_project_type_idx").on(table.projectId, table.type),
  }),
);

export const entityAliases = sqliteTable(
  "entity_aliases",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    normalizedAlias: text("normalized_alias").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    aliasLengthCheck: check("entity_aliases_alias_length_check", sql`length(${table.alias}) >= 1`),
    normalizedAliasLengthCheck: check(
      "entity_aliases_normalized_alias_length_check",
      sql`length(${table.normalizedAlias}) >= 1`,
    ),
    projectNormalizedAliasUniqueIdx: uniqueIndex("entity_aliases_project_normalized_alias_uidx").on(
      table.projectId,
      table.normalizedAlias,
    ),
    entityIdIdx: index("entity_aliases_entity_id_idx").on(table.entityId),
    projectEntityIdx: index("entity_aliases_project_entity_idx").on(table.projectId, table.entityId),
  }),
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    chapterOrder: integer("chapter_order").notNull(),
    sequenceNo: integer("sequence_no").notNull().default(0),
    title: text("title").notNull(),
    summary: text("summary"),
    evidence: text("evidence"),
    confidence: real("confidence").notNull().default(0.5),
    status: text("status", { enum: TIMELINE_EVENT_STATUSES }).$type<TimelineEventStatus>().notNull(),
    version: integer("version").notNull().default(1),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    chapterOrderNonNegativeCheck: check(
      "events_chapter_order_non_negative_check",
      sql`${table.chapterOrder} >= 0`,
    ),
    sequenceNoNonNegativeCheck: check("events_sequence_no_non_negative_check", sql`${table.sequenceNo} >= 0`),
    titleLengthCheck: check("events_title_length_check", sql`length(${table.title}) >= 1`),
    confidenceRangeCheck: check(
      "events_confidence_range_check",
      sql`${table.confidence} >= 0 and ${table.confidence} <= 1`,
    ),
    versionPositiveCheck: check("events_version_positive_check", sql`${table.version} >= 1`),
    projectDedupeKeyUniqueIdx: uniqueIndex("events_project_dedupe_key_uidx").on(
      table.projectId,
      table.dedupeKey,
    ),
    projectChapterOrderIdx: index("events_project_chapter_order_idx").on(
      table.projectId,
      table.chapterOrder,
      table.sequenceNo,
    ),
    projectStatusIdx: index("events_project_status_idx").on(table.projectId, table.status),
    chapterIdIdx: index("events_chapter_id_idx").on(table.chapterId),
  }),
);

export const eventEntities = sqliteTable(
  "event_entities",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("subject"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    eventEntityPk: primaryKey({
      name: "event_entities_event_id_entity_id_pk",
      columns: [table.eventId, table.entityId],
    }),
    roleLengthCheck: check("event_entities_role_length_check", sql`length(${table.role}) >= 1`),
    entityIdIdx: index("event_entities_entity_id_idx").on(table.entityId),
    eventIdIdx: index("event_entities_event_id_idx").on(table.eventId),
  }),
);

export const timelineSnapshots = sqliteTable(
  "timeline_snapshots",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    eventId: text("event_id").references(() => events.id, { onDelete: "set null" }),
    snapshotType: text("snapshot_type", { enum: TIMELINE_SNAPSHOT_TYPES })
      .$type<TimelineSnapshotType>()
      .notNull(),
    eventVersion: integer("event_version"),
    payload: text("payload").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    eventVersionPositiveCheck: check(
      "timeline_snapshots_event_version_positive_check",
      sql`${table.eventVersion} is null or ${table.eventVersion} >= 1`,
    ),
    projectCreatedAtIdx: index("timeline_snapshots_project_created_at_idx").on(
      table.projectId,
      table.createdAt,
    ),
    eventIdIdx: index("timeline_snapshots_event_id_idx").on(table.eventId),
    chapterIdIdx: index("timeline_snapshots_chapter_id_idx").on(table.chapterId),
  }),
);

export type TimelineEntityRow = typeof entities.$inferSelect;
export type NewTimelineEntityRow = typeof entities.$inferInsert;
export type EntityAliasRow = typeof entityAliases.$inferSelect;
export type NewEntityAliasRow = typeof entityAliases.$inferInsert;
export type TimelineEventRow = typeof events.$inferSelect;
export type NewTimelineEventRow = typeof events.$inferInsert;
export type EventEntityRow = typeof eventEntities.$inferSelect;
export type NewEventEntityRow = typeof eventEntities.$inferInsert;
export type TimelineSnapshotRow = typeof timelineSnapshots.$inferSelect;
export type NewTimelineSnapshotRow = typeof timelineSnapshots.$inferInsert;
