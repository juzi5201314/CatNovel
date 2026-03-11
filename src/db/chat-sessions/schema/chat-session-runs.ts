import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { chatSessions } from "./chat-sessions";

export const CHAT_SESSION_RUN_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "stopped",
] as const;

export type ChatSessionRunStatus = (typeof CHAT_SESSION_RUN_STATUSES)[number];

export const chatSessionRuns = sqliteTable(
  "chat_session_runs",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    chapterId: text("chapter_id"),
    status: text("status", { enum: CHAT_SESSION_RUN_STATUSES })
      .$type<ChatSessionRunStatus>()
      .notNull()
      .default("queued"),
    stopRequested: integer("stop_requested", { mode: "boolean" }).notNull().default(false),
    inputMessagesJson: text("input_messages_json").notNull().default("[]"),
    responseMessageJson: text("response_message_json"),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
  (table) => ({
    statusCheck: check(
      "chat_session_runs_status_check",
      sql`${table.status} in ('queued', 'running', 'completed', 'failed', 'stopped')`,
    ),
    sessionCreatedIdx: index("chat_session_runs_session_created_idx").on(
      table.sessionId,
      table.createdAt,
    ),
    projectStatusUpdatedIdx: index("chat_session_runs_project_status_updated_idx").on(
      table.projectId,
      table.status,
      table.updatedAt,
    ),
  }),
);

export type ChatSessionRunRow = typeof chatSessionRuns.$inferSelect;
export type NewChatSessionRunRow = typeof chatSessionRuns.$inferInsert;
