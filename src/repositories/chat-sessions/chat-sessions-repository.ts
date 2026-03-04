import { desc, eq } from "drizzle-orm";

import type { ChatSessionsDatabase } from "@/db/chat-sessions/client";
import { chatSessions } from "@/db/chat-sessions/schema";

import { ChatSessionsBaseRepository } from "./base-repository";

type ChatSessionMessages = unknown[];

export type ChatSessionSummaryRecord = {
  id: string;
  projectId: string;
  chapterId: string | null;
  title: string;
  messageCount: number;
  chatTerminated: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatSessionRecord = ChatSessionSummaryRecord & {
  messages: ChatSessionMessages;
};

export type ChatSessionScopeInput = {
  projectId: string;
};

export type CreateChatSessionInput = {
  id: string;
  projectId: string;
  chapterId: string | null;
  title: string;
  messages: ChatSessionMessages;
  chatTerminated: boolean;
};

export type UpdateChatSessionPatch = {
  title?: string;
  messages?: ChatSessionMessages;
  chatTerminated?: boolean;
};

function parseMessagesJson(raw: string): ChatSessionMessages {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

function toSummaryRecord(row: typeof chatSessions.$inferSelect): ChatSessionSummaryRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    chapterId: row.chapterId ?? null,
    title: row.title,
    messageCount: row.messageCount,
    chatTerminated: row.chatTerminated,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDetailRecord(row: typeof chatSessions.$inferSelect): ChatSessionRecord {
  return {
    ...toSummaryRecord(row),
    messages: parseMessagesJson(row.messagesJson),
  };
}

export class ChatSessionsRepository extends ChatSessionsBaseRepository {
  constructor(database?: ChatSessionsDatabase) {
    super(database);
  }

  listByScope(input: ChatSessionScopeInput): ChatSessionSummaryRecord[] {
    return this.db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.projectId, input.projectId))
      .orderBy(desc(chatSessions.updatedAt), desc(chatSessions.createdAt))
      .all()
      .map((row) => toSummaryRecord(row));
  }

  findById(sessionId: string): ChatSessionRecord | null {
    const row = this.db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .get();
    return row ? toDetailRecord(row) : null;
  }

  create(input: CreateChatSessionInput): ChatSessionRecord {
    const messagesJson = JSON.stringify(input.messages ?? []);
    const messageCount = Array.isArray(input.messages) ? input.messages.length : 0;

    this.db
      .insert(chatSessions)
      .values({
        id: input.id,
        projectId: input.projectId,
        chapterId: input.chapterId,
        title: input.title,
        messagesJson,
        messageCount,
        chatTerminated: input.chatTerminated,
      })
      .run();

    const created = this.findById(input.id);
    if (!created) {
      throw new Error("failed to create chat session");
    }
    return created;
  }

  updateAndGet(sessionId: string, patch: UpdateChatSessionPatch): ChatSessionRecord | null {
    if (Object.keys(patch).length === 0) {
      return this.findById(sessionId);
    }

    const updatePayload: Partial<typeof chatSessions.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (patch.title !== undefined) {
      updatePayload.title = patch.title;
    }
    if (patch.chatTerminated !== undefined) {
      updatePayload.chatTerminated = patch.chatTerminated;
    }
    if (patch.messages !== undefined) {
      updatePayload.messagesJson = JSON.stringify(patch.messages);
      updatePayload.messageCount = patch.messages.length;
    }

    const result = this.db
      .update(chatSessions)
      .set(updatePayload)
      .where(eq(chatSessions.id, sessionId))
      .run();

    if (result.changes === 0) {
      return null;
    }

    return this.findById(sessionId);
  }

  delete(sessionId: string): boolean {
    const result = this.db
      .delete(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .run();
    return result.changes > 0;
  }
}
