import { randomUUID } from 'node:crypto';

import { getDatabase, withImmediateTransaction } from '../../../db/client.ts';
import type {
  ChatMessageRecord,
  ChatRole,
  ChatSessionRecord,
} from '../../contracts/workspace.ts';

type ChatSessionRow = {
  id: string;
  workId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type ChatMessageRow = {
  id: string;
  sessionId: string;
  role: ChatRole;
  body: string;
  tps: number;
  createdAt: string;
};

function hydrateChatSession(row: ChatSessionRow): ChatSessionRecord {
  return {
    id: row.id,
    workId: row.workId,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function hydrateChatMessage(row: ChatMessageRow): ChatMessageRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role,
    body: row.body,
    tps: row.tps,
    createdAt: row.createdAt,
  };
}

export function listChatSessions(workId: string) {
  return getDatabase()
    .prepare(
      `SELECT
        id,
        work_id AS workId,
        title,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM chat_sessions
      WHERE work_id = ?
      ORDER BY updated_at DESC, created_at DESC`,
    )
    .all(workId)
    .map((row) => hydrateChatSession(row as ChatSessionRow));
}

export function getChatSession(sessionId: string) {
  const row = getDatabase()
    .prepare(
      `SELECT
        id,
        work_id AS workId,
        title,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM chat_sessions
      WHERE id = ?`,
    )
    .get(sessionId) as ChatSessionRow | undefined;

  if (!row) {
    throw new Error(`Unknown chat session: ${sessionId}`);
  }

  return hydrateChatSession(row);
}

export function listChatMessages(sessionId: string) {
  return getDatabase()
    .prepare(
      `SELECT
        id,
        session_id AS sessionId,
        role,
        body,
        tps,
        created_at AS createdAt
      FROM chat_messages
      WHERE session_id = ?
      ORDER BY created_at ASC`,
    )
    .all(sessionId)
    .map((row) => hydrateChatMessage(row as ChatMessageRow));
}

export function createChatSession(input: { workId: string; title: string }) {
  const id = randomUUID();
  const now = new Date().toISOString();

  getDatabase()
    .prepare(
      `INSERT INTO chat_sessions (id, work_id, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, input.workId, input.title, now, now);

  return getChatSession(id);
}

export function updateChatSession(sessionId: string, title: string) {
  const now = new Date().toISOString();

  getDatabase()
    .prepare(
      `UPDATE chat_sessions
         SET title = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(title, now, sessionId);

  return getChatSession(sessionId);
}

export function deleteChatSession(sessionId: string) {
  const current = getChatSession(sessionId);
  getDatabase().prepare('DELETE FROM chat_sessions WHERE id = ?').run(sessionId);
  return current;
}

export function appendChatMessage(input: {
  sessionId: string;
  role: ChatRole;
  body: string;
  tps?: number;
}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const db = getDatabase();

  withImmediateTransaction(db, () => {
    db.prepare(
      `INSERT INTO chat_messages (id, session_id, role, body, tps, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, input.sessionId, input.role, input.body, input.tps ?? 0, now);

    db.prepare(
      `UPDATE chat_sessions
         SET updated_at = ?
       WHERE id = ?`,
    ).run(now, input.sessionId);
  });

  return getChatMessage(id);
}

export function getChatMessage(messageId: string) {
  const row = getDatabase()
    .prepare(
      `SELECT
        id,
        session_id AS sessionId,
        role,
        body,
        tps,
        created_at AS createdAt
      FROM chat_messages
      WHERE id = ?`,
    )
    .get(messageId) as ChatMessageRow | undefined;

  if (!row) {
    throw new Error(`Unknown chat message: ${messageId}`);
  }

  return hydrateChatMessage(row);
}

export function deleteChatMessage(messageId: string) {
  const current = getChatMessage(messageId);
  getDatabase().prepare('DELETE FROM chat_messages WHERE id = ?').run(messageId);
  return current;
}
