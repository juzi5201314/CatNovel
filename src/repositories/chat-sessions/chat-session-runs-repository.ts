import { and, desc, eq, inArray } from "drizzle-orm";

import type { ChatSessionsDatabase } from "@/db/chat-sessions/client";
import type { ChatSessionRunStatus } from "@/db/chat-sessions/schema";
import { chatSessionRuns } from "@/db/chat-sessions/schema";

import { ChatSessionsBaseRepository } from "./base-repository";

const ACTIVE_CHAT_RUN_STATUSES: ChatSessionRunStatus[] = ["queued", "running"];

export type ChatSessionRunRecord = {
  id: string;
  sessionId: string;
  projectId: string;
  chapterId: string | null;
  status: ChatSessionRunStatus;
  stopRequested: boolean;
  inputMessages: unknown[];
  responseMessage: unknown | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export type CreateChatSessionRunInput = {
  id: string;
  sessionId: string;
  projectId: string;
  chapterId: string | null;
  inputMessages: unknown[];
};

function parseJsonArray(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseNullableJson(raw: string | null): unknown | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function toRecord(row: typeof chatSessionRuns.$inferSelect): ChatSessionRunRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    projectId: row.projectId,
    chapterId: row.chapterId ?? null,
    status: row.status,
    stopRequested: row.stopRequested,
    inputMessages: parseJsonArray(row.inputMessagesJson),
    responseMessage: parseNullableJson(row.responseMessageJson),
    errorMessage: row.errorMessage ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    startedAt: row.startedAt ?? null,
    finishedAt: row.finishedAt ?? null,
  };
}

export class ChatSessionRunsRepository extends ChatSessionsBaseRepository {
  constructor(database?: ChatSessionsDatabase) {
    super(database);
  }

  createQueued(input: CreateChatSessionRunInput): ChatSessionRunRecord {
    this.db
      .insert(chatSessionRuns)
      .values({
        id: input.id,
        sessionId: input.sessionId,
        projectId: input.projectId,
        chapterId: input.chapterId,
        status: "queued",
        stopRequested: false,
        inputMessagesJson: JSON.stringify(input.inputMessages ?? []),
      })
      .run();

    const created = this.findById(input.id);
    if (!created) {
      throw new Error("failed to create chat session run");
    }

    return created;
  }

  findById(runId: string): ChatSessionRunRecord | null {
    const row = this.db
      .select()
      .from(chatSessionRuns)
      .where(eq(chatSessionRuns.id, runId))
      .get();
    return row ? toRecord(row) : null;
  }

  findLatestBySessionId(sessionId: string): ChatSessionRunRecord | null {
    const row = this.db
      .select()
      .from(chatSessionRuns)
      .where(eq(chatSessionRuns.sessionId, sessionId))
      .orderBy(desc(chatSessionRuns.createdAt), desc(chatSessionRuns.id))
      .get();
    return row ? toRecord(row) : null;
  }

  findLatestActiveBySessionId(sessionId: string): ChatSessionRunRecord | null {
    const row = this.db
      .select()
      .from(chatSessionRuns)
      .where(
        and(
          eq(chatSessionRuns.sessionId, sessionId),
          inArray(chatSessionRuns.status, ACTIVE_CHAT_RUN_STATUSES),
        ),
      )
      .orderBy(desc(chatSessionRuns.createdAt), desc(chatSessionRuns.id))
      .get();
    return row ? toRecord(row) : null;
  }

  markRunning(runId: string): ChatSessionRunRecord | null {
    const now = new Date();
    const result = this.db
      .update(chatSessionRuns)
      .set({
        status: "running",
        updatedAt: now,
        startedAt: now,
      })
      .where(eq(chatSessionRuns.id, runId))
      .run();

    if (result.changes === 0) {
      return null;
    }

    return this.findById(runId);
  }

  markStopRequested(runId: string): ChatSessionRunRecord | null {
    const result = this.db
      .update(chatSessionRuns)
      .set({
        stopRequested: true,
        updatedAt: new Date(),
      })
      .where(eq(chatSessionRuns.id, runId))
      .run();

    if (result.changes === 0) {
      return null;
    }

    return this.findById(runId);
  }

  markCompleted(runId: string, responseMessage: unknown): ChatSessionRunRecord | null {
    const now = new Date();
    const result = this.db
      .update(chatSessionRuns)
      .set({
        status: "completed",
        stopRequested: false,
        responseMessageJson: JSON.stringify(responseMessage ?? null),
        errorMessage: null,
        updatedAt: now,
        finishedAt: now,
      })
      .where(eq(chatSessionRuns.id, runId))
      .run();

    if (result.changes === 0) {
      return null;
    }

    return this.findById(runId);
  }

  markFailed(runId: string, errorMessage: string): ChatSessionRunRecord | null {
    const now = new Date();
    const result = this.db
      .update(chatSessionRuns)
      .set({
        status: "failed",
        errorMessage,
        updatedAt: now,
        finishedAt: now,
      })
      .where(eq(chatSessionRuns.id, runId))
      .run();

    if (result.changes === 0) {
      return null;
    }

    return this.findById(runId);
  }

  markStopped(runId: string, reason?: string): ChatSessionRunRecord | null {
    const now = new Date();
    const result = this.db
      .update(chatSessionRuns)
      .set({
        status: "stopped",
        stopRequested: true,
        errorMessage: reason ?? null,
        updatedAt: now,
        finishedAt: now,
      })
      .where(eq(chatSessionRuns.id, runId))
      .run();

    if (result.changes === 0) {
      return null;
    }

    return this.findById(runId);
  }
}
