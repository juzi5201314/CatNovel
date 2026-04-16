import { randomUUID } from 'node:crypto';

import { getDatabase } from '../../../db/client.ts';
import type {
  BookMetadataRecord,
  SettingNodeRecord,
  SettingNodeType,
  WorldviewNodeType,
} from '../../contracts/workspace.ts';

type SettingNodeRow = {
  id: string;
  workId: string;
  parentId: string | null;
  nodeType: SettingNodeType | WorldviewNodeType;
  sortIndex: number;
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
    sortIndex: row.sortIndex,
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
        sort_index AS sortIndex,
        title,
        payload_json AS payloadJson,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM settings_nodes
      WHERE work_id = ?
      ORDER BY COALESCE(parent_id, ''), sort_index ASC, created_at ASC`,
    )
    .all(workId)
    .map((row) => hydrateSettingNode(row as SettingNodeRow));
}

export function createSettingNode(input: {
  workId: string;
  parentId?: string | null;
  nodeType: SettingNodeType | WorldviewNodeType;
  sortIndex?: number;
  title: string;
  payloadJson?: string;
}) {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  const maxSortResult = db
    .prepare(
      `SELECT COALESCE(MAX(sort_index), -1) as maxSort
       FROM settings_nodes
       WHERE work_id = ? AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL))`
    )
    .get(input.workId, input.parentId ?? null, input.parentId ?? null) as { maxSort: number };

  const sortIndex = input.sortIndex ?? (maxSortResult.maxSort + 1);

  db.prepare(
    `INSERT INTO settings_nodes (
      id,
      work_id,
      parent_id,
      node_type,
      sort_index,
      title,
      payload_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.workId,
    input.parentId ?? null,
    input.nodeType,
    sortIndex,
    input.title,
    input.payloadJson ?? '{"schemaVersion":1}',
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
        sort_index AS sortIndex,
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
    nodeType: SettingNodeType | WorldviewNodeType;
    sortIndex: number;
    title: string;
    payloadJson: string;
  }>,
) {
  const current = getSettingNode(nodeId);
  const next = {
    parentId: updates.parentId !== undefined ? updates.parentId : current.parentId,
    nodeType: updates.nodeType !== undefined ? updates.nodeType : current.nodeType,
    sortIndex: updates.sortIndex !== undefined ? updates.sortIndex : current.sortIndex,
    title: updates.title !== undefined ? updates.title : current.title,
    payloadJson: updates.payloadJson !== undefined ? updates.payloadJson : current.payloadJson,
    updatedAt: new Date().toISOString(),
  };

  getDatabase()
    .prepare(
      `UPDATE settings_nodes
         SET parent_id = ?,
             node_type = ?,
             sort_index = ?,
             title = ?,
             payload_json = ?,
             updated_at = ?
       WHERE id = ?`,
    )
    .run(
      next.parentId ?? null,
      next.nodeType,
      next.sortIndex,
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

export function getChildren(nodeId: string) {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT
        id,
        work_id AS workId,
        parent_id AS parentId,
        node_type AS nodeType,
        sort_index AS sortIndex,
        title,
        payload_json AS payloadJson,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM settings_nodes
      WHERE parent_id = ?
      ORDER BY sort_index ASC, created_at ASC`
    )
    .all(nodeId) as SettingNodeRow[];

  return rows.map((row) => hydrateSettingNode(row));
}

export function hasChildren(nodeId: string): boolean {
  const db = getDatabase();
  const result = db
    .prepare('SELECT COUNT(*) as count FROM settings_nodes WHERE parent_id = ?')
    .get(nodeId) as { count: number };
  return result.count > 0;
}

export function moveSettingNode(
  nodeId: string,
  newParentId: string | null
) {
  const node = getSettingNode(nodeId);

  if (newParentId !== null) {
    const targetParent = getSettingNode(newParentId);

    if (targetParent.workId !== node.workId) {
      throw new Error('Cannot move node to a different work');
    }
  }

  const maxSortResult = getDatabase()
    .prepare(
      `SELECT COALESCE(MAX(sort_index), -1) as maxSort
       FROM settings_nodes
       WHERE work_id = ? AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL))`
    )
    .get(node.workId, newParentId ?? null, newParentId ?? null) as { maxSort: number };

  return updateSettingNode(nodeId, {
    parentId: newParentId,
    sortIndex: maxSortResult.maxSort + 1,
  });
}

export function reorderSiblings(
  workId: string,
  parentId: string | null,
  orderedIds: string[]
) {
  const db = getDatabase();
  db.exec('BEGIN IMMEDIATE');

  try {
    const statement = db.prepare(
      'UPDATE settings_nodes SET sort_index = ? WHERE id = ? AND work_id = ?'
    );

    for (let i = 0; i < orderedIds.length; i++) {
      statement.run(i, orderedIds[i], workId);
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function wouldCreateCycle(nodeId: string, proposedParentId: string): boolean {
  if (nodeId === proposedParentId) {
    return true;
  }

  let currentId: string | null = proposedParentId;
  const visited = new Set<string>();

  while (currentId !== null) {
    if (visited.has(currentId)) {
      return true;
    }
    visited.add(currentId);

    if (currentId === nodeId) {
      return true;
    }

    const parent = getDatabase()
      .prepare('SELECT parent_id FROM settings_nodes WHERE id = ?')
      .get(currentId) as { parent_id: string | null } | undefined;

    currentId = parent?.parent_id ?? null;
  }

  return false;
}
