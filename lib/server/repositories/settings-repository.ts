import { randomUUID } from 'node:crypto';

import { getDatabase } from '../../../db/client.ts';
import type {
  BookMetadataRecord,
  SettingNodeRecord,
  SettingNodeType,
} from '../../contracts/workspace.ts';

type SettingNodeRow = {
  id: string;
  workId: string;
  parentId: string | null;
  nodeType: SettingNodeType;
  title: string;
  payloadJson: string;
  createdAt: string;
  updatedAt: string;
};

type BookMetadataRow = {
  workId: string;
  authorName: string;
  premise: string;
  targetReaders: string;
  serializedStatus: string;
  tagsJson: string;
  updatedAt: string;
};

function hydrateSettingNode(row: SettingNodeRow): SettingNodeRecord {
  return {
    id: row.id,
    workId: row.workId,
    parentId: row.parentId,
    nodeType: row.nodeType,
    title: row.title,
    payloadJson: row.payloadJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function hydrateBookMetadata(row: BookMetadataRow): BookMetadataRecord {
  return {
    workId: row.workId,
    authorName: row.authorName,
    premise: row.premise,
    targetReaders: row.targetReaders,
    serializedStatus: row.serializedStatus,
    tagsJson: row.tagsJson,
    updatedAt: row.updatedAt,
  };
}

export function listSettingsNodes(workId: string) {
  const db = getDatabase();

  return db
    .prepare(
      `SELECT
        id,
        work_id AS workId,
        parent_id AS parentId,
        node_type AS nodeType,
        title,
        payload_json AS payloadJson,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM settings_nodes
      WHERE work_id = ?
      ORDER BY created_at ASC`,
    )
    .all(workId)
    .map((row) => hydrateSettingNode(row as SettingNodeRow));
}

export function createSettingNode(input: {
  workId: string;
  parentId?: string | null;
  nodeType: SettingNodeType;
  title: string;
  payloadJson?: string;
}) {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO settings_nodes (
      id,
      work_id,
      parent_id,
      node_type,
      title,
      payload_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.workId,
    input.parentId ?? null,
    input.nodeType,
    input.title,
    input.payloadJson ?? '{"summary":""}',
    now,
    now,
  );

  return getSettingNode(id);
}

export function getSettingNode(nodeId: string) {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT
        id,
        work_id AS workId,
        parent_id AS parentId,
        node_type AS nodeType,
        title,
        payload_json AS payloadJson,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM settings_nodes
      WHERE id = ?`,
    )
    .get(nodeId) as SettingNodeRow | undefined;

  if (!row) {
    throw new Error(`Unknown settings node: ${nodeId}`);
  }

  return hydrateSettingNode(row);
}

export function updateSettingNode(
  nodeId: string,
  updates: Partial<{
    parentId: string | null;
    nodeType: SettingNodeType;
    title: string;
    payloadJson: string;
  }>,
) {
  const current = getSettingNode(nodeId);
  const next = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  getDatabase()
    .prepare(
      `UPDATE settings_nodes
         SET parent_id = ?,
             node_type = ?,
             title = ?,
             payload_json = ?,
             updated_at = ?
       WHERE id = ?`,
    )
    .run(
      next.parentId ?? null,
      next.nodeType,
      next.title,
      next.payloadJson,
      next.updatedAt,
      nodeId,
    );

  return getSettingNode(nodeId);
}

function collectDescendantIds(nodeId: string, acc: string[] = []) {
  const db = getDatabase();
  const children = db
    .prepare('SELECT id FROM settings_nodes WHERE parent_id = ?')
    .all(nodeId) as Array<{ id: string }>;

  for (const child of children) {
    acc.push(child.id);
    collectDescendantIds(child.id, acc);
  }

  return acc;
}

export function deleteSettingNode(nodeId: string) {
  const ids = [nodeId, ...collectDescendantIds(nodeId)];
  const db = getDatabase();
  db.exec('BEGIN IMMEDIATE');
  try {
    const statement = db.prepare('DELETE FROM settings_nodes WHERE id = ?');
    for (const id of ids.reverse()) {
      statement.run(id);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function getBookMetadata(workId: string) {
  const db = getDatabase();
  const existing = db
    .prepare(
      `SELECT
        work_id AS workId,
        author_name AS authorName,
        premise,
        target_readers AS targetReaders,
        serialized_status AS serializedStatus,
        tags_json AS tagsJson,
        updated_at AS updatedAt
      FROM book_metadata
      WHERE work_id = ?`,
    )
    .get(workId) as BookMetadataRow | undefined;

  if (existing) {
    return hydrateBookMetadata(existing);
  }

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO book_metadata (
      work_id,
      author_name,
      premise,
      target_readers,
      serialized_status,
      tags_json,
      updated_at
    ) VALUES (?, '', '', '', 'ongoing', '[]', ?)`,
  ).run(workId, now);

  return getBookMetadata(workId);
}

export function updateBookMetadata(
  workId: string,
  updates: Partial<Omit<BookMetadataRecord, 'workId' | 'updatedAt'>>,
) {
  const current = getBookMetadata(workId);
  const next = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  getDatabase()
    .prepare(
      `UPDATE book_metadata
         SET author_name = ?,
             premise = ?,
             target_readers = ?,
             serialized_status = ?,
             tags_json = ?,
             updated_at = ?
       WHERE work_id = ?`,
    )
    .run(
      next.authorName,
      next.premise,
      next.targetReaders,
      next.serializedStatus,
      next.tagsJson,
      next.updatedAt,
      workId,
    );

  return getBookMetadata(workId);
}
