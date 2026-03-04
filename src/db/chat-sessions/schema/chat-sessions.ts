import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const chatSessions = sqliteTable(
  "chat_sessions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    chapterId: text("chapter_id"),
    title: text("title").notNull(),
    messagesJson: text("messages_json").notNull().default("[]"),
    messageCount: integer("message_count").notNull().default(0),
    chatTerminated: integer("chat_terminated", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    projectChapterUpdatedIdx: index("chat_sessions_project_chapter_updated_idx").on(
      table.projectId,
      table.chapterId,
      table.updatedAt,
    ),
    projectUpdatedIdx: index("chat_sessions_project_updated_idx").on(
      table.projectId,
      table.updatedAt,
    ),
  }),
);

export type ChatSessionRow = typeof chatSessions.$inferSelect;
export type NewChatSessionRow = typeof chatSessions.$inferInsert;
