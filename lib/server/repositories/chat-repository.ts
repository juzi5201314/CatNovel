import { randomUUID } from 'node:crypto';

import { getDatabase, withImmediateTransaction } from '../../../db/client.ts';
import type {
  ChatMessageRecord,
  ChatMessageVersion,
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
  activeVersionId: string | null;
};

type ChatMessageVersionRow = {
  id: string;
  messageId: string;
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
    activeVersionId: row.activeVersionId,
    versions: undefined,
  };
}

function hydrateChatMessageVersion(row: ChatMessageVersionRow): ChatMessageVersion {
  return {
    id: row.id,
    messageId: row.messageId,
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

export function listChatMessages(sessionId: string): ChatMessageRecord[] {
  const db = getDatabase();

  // 加载消息
  const messages = db
    .prepare(
      `SELECT
        id,
        session_id AS sessionId,
        role,
        body,
        tps,
        created_at AS createdAt,
        active_version_id AS activeVersionId
      FROM chat_messages
      WHERE session_id = ?
      ORDER BY created_at ASC`,
    )
    .all(sessionId)
    .map((row) => hydrateChatMessage(row as ChatMessageRow));

  // 加载所有版本并按消息ID分组
  const versions = db
    .prepare(
      `SELECT
        v.id,
        v.message_id AS messageId,
        v.body,
        v.tps,
        v.created_at AS createdAt
      FROM chat_message_versions v
      JOIN chat_messages m ON v.message_id = m.id
      WHERE m.session_id = ?
      ORDER BY v.created_at ASC`,
    )
    .all(sessionId)
    .map((row) => hydrateChatMessageVersion(row as ChatMessageVersionRow));

  const versionsByMessageId = new Map<string, ChatMessageVersion[]>();
  for (const version of versions) {
    const list = versionsByMessageId.get(version.messageId) ?? [];
    list.push(version);
    versionsByMessageId.set(version.messageId, list);
  }

  // 将版本附加到对应的消息
  for (const message of messages) {
    message.versions = versionsByMessageId.get(message.id);
  }

  return messages;
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

// Message Version Operations

export function addMessageVersion(input: {
  messageId: string;
  body: string;
  tps?: number;
}): ChatMessageVersion {
  const id = randomUUID();
  const now = new Date().toISOString();
  const db = getDatabase();

  db.prepare(
    `INSERT INTO chat_message_versions (id, message_id, body, tps, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, input.messageId, input.body, input.tps ?? 0, now);

  const row = db
    .prepare(
      `SELECT id, message_id AS messageId, body, tps, created_at AS createdAt
       FROM chat_message_versions
       WHERE id = ?`,
    )
    .get(id) as ChatMessageVersionRow;

  return hydrateChatMessageVersion(row);
}

export function listMessageVersions(messageId: string): ChatMessageVersion[] {
  return getDatabase()
    .prepare(
      `SELECT id, message_id AS messageId, body, tps, created_at AS createdAt
       FROM chat_message_versions
       WHERE message_id = ?
       ORDER BY created_at ASC`,
    )
    .all(messageId)
    .map((row) => hydrateChatMessageVersion(row as ChatMessageVersionRow));
}

export function setActiveMessageVersion(messageId: string, versionId: string | null): void {
  const db = getDatabase();
  db.prepare(
    `UPDATE chat_messages SET active_version_id = ? WHERE id = ?`,
  ).run(versionId, messageId);
}

export function getActiveMessageVersion(messageId: string): ChatMessageVersion | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT v.id, v.message_id AS messageId, v.body, v.tps, v.created_at AS createdAt
       FROM chat_message_versions v
       JOIN chat_messages m ON v.id = m.active_version_id
       WHERE m.id = ?`,
    )
    .get(messageId) as ChatMessageVersionRow | undefined;

  return row ? hydrateChatMessageVersion(row) : null;
}

export function deleteMessageVersion(versionId: string): void {
  getDatabase().prepare('DELETE FROM chat_message_versions WHERE id = ?').run(versionId);
}

export interface PendingAskUserQuestion {
  id: string;
  sessionId: string;
  toolCallId: string;
  question: string;
  options?: string[];
  multiselect?: boolean;
  context?: string;
  type: 'text' | 'choice';
  createdAt: string;
}

type PendingAskUserRow = {
  id: string;
  sessionId: string;
  toolCallId: string;
  question: string;
  optionsJson: string | null;
  multiselect: number;
  context: string | null;
  questionType: 'text' | 'choice';
  createdAt: string;
};

function hydratePendingAskUser(row: PendingAskUserRow): PendingAskUserQuestion {
  return {
    id: row.id,
    sessionId: row.sessionId,
    toolCallId: row.toolCallId,
    question: row.question,
    options: row.optionsJson ? JSON.parse(row.optionsJson) : undefined,
    multiselect: row.multiselect === 1,
    context: row.context ?? undefined,
    type: row.questionType,
    createdAt: row.createdAt,
  };
}

export function listPendingAskUserQuestions(sessionId: string): PendingAskUserQuestion[] {
  return getDatabase()
    .prepare(
      `SELECT
        id,
        session_id AS sessionId,
        tool_call_id AS toolCallId,
        question,
        options_json AS optionsJson,
        multiselect,
        context,
        question_type AS questionType,
        created_at AS createdAt
      FROM pending_ask_user_questions
      WHERE session_id = ?
      ORDER BY created_at ASC`,
    )
    .all(sessionId)
    .map((row) => hydratePendingAskUser(row as PendingAskUserRow));
}

export function savePendingAskUserQuestion(input: {
  sessionId: string;
  toolCallId: string;
  question: string;
  options?: string[];
  multiselect?: boolean;
  context?: string;
  type: 'text' | 'choice';
}): PendingAskUserQuestion {
  const id = randomUUID();
  const now = new Date().toISOString();

  getDatabase()
    .prepare(
      `INSERT INTO pending_ask_user_questions
       (id, session_id, tool_call_id, question, options_json, multiselect, context, question_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, tool_call_id) DO UPDATE SET
       question = excluded.question,
       options_json = excluded.options_json,
       multiselect = excluded.multiselect,
       context = excluded.context,
       question_type = excluded.question_type`,
    )
    .run(
      id,
      input.sessionId,
      input.toolCallId,
      input.question,
      input.options ? JSON.stringify(input.options) : null,
      input.multiselect ? 1 : 0,
      input.context ?? null,
      input.type,
      now,
    );

  const row = getDatabase()
    .prepare(
      `SELECT
        id,
        session_id AS sessionId,
        tool_call_id AS toolCallId,
        question,
        options_json AS optionsJson,
        multiselect,
        context,
        question_type AS questionType,
        created_at AS createdAt
      FROM pending_ask_user_questions
      WHERE id = ?`,
    )
    .get(id) as PendingAskUserRow;

  return hydratePendingAskUser(row);
}

export function deletePendingAskUserQuestion(toolCallId: string): void {
  getDatabase()
    .prepare('DELETE FROM pending_ask_user_questions WHERE tool_call_id = ?')
    .run(toolCallId);
}

export function deleteAllPendingAskUserQuestions(sessionId: string): void {
  getDatabase()
    .prepare('DELETE FROM pending_ask_user_questions WHERE session_id = ?')
    .run(sessionId);
}
