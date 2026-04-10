import { randomUUID } from "node:crypto";
import type { SQLInputValue } from "node:sqlite";

import { getDatabase } from "../../db/client.ts";

const workScopedTables = [
  "chapters",
  "chapter_order",
  "settings_nodes",
  "book_metadata",
  "chat_sessions",
  "chat_messages",
  "ai_provider_profiles",
  "context_selections",
  "chapter_summaries",
  "generation_archive",
  "token_usage_records",
  "import_jobs",
  "export_jobs",
] as const;

type SnapshotTable = (typeof workScopedTables)[number] | "app_preferences";
const snapshotTables: readonly SnapshotTable[] = [...workScopedTables, "app_preferences"];

const insertOrder: SnapshotTable[] = [
  "chapters",
  "chapter_order",
  "settings_nodes",
  "book_metadata",
  "chat_sessions",
  "chat_messages",
  "ai_provider_profiles",
  "context_selections",
  "chapter_summaries",
  "generation_archive",
  "token_usage_records",
  "import_jobs",
  "export_jobs",
  "app_preferences",
];

const deleteOrder = [...insertOrder].reverse();

function nowIso() {
  return new Date().toISOString();
}

function queryRows(table: SnapshotTable, workId: string) {
  const db = getDatabase();

  switch (table) {
    case "app_preferences":
      return db.prepare("SELECT * FROM app_preferences").all() as Record<string, unknown>[];
    case "chat_messages":
      return db
        .prepare(
          `SELECT m.*
           FROM chat_messages m
           INNER JOIN chat_sessions s ON s.id = m.session_id
           WHERE s.work_id = ?`,
        )
        .all(workId) as Record<string, unknown>[];
    case "chapter_order":
      return db
        .prepare(
          `SELECT o.*
           FROM chapter_order o
           INNER JOIN chapters c ON c.id = o.chapter_id
           WHERE c.work_id = ?`,
        )
        .all(workId) as Record<string, unknown>[];
    case "chapter_summaries":
      return db
        .prepare(
          `SELECT s.*
           FROM chapter_summaries s
           INNER JOIN chapters c ON c.id = s.chapter_id
           WHERE c.work_id = ?`,
        )
        .all(workId) as Record<string, unknown>[];
    default:
      return db
        .prepare(`SELECT * FROM ${table} WHERE work_id = ?`)
        .all(workId) as Record<string, unknown>[];
  }
}

function insertRows(table: SnapshotTable, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return;
  }

  const db = getDatabase();

  for (const row of rows) {
    const entries = Object.entries(row);
    if (entries.length === 0) {
      continue;
    }

    const columns = entries.map(([column]) => column);
    const placeholders = columns.map(() => "?").join(", ");
    const statement = db.prepare(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
    );
    const values = entries.map(([, value]) => value as SQLInputValue);
    statement.run(...values);
  }
}

function deleteCurrentState(workId: string) {
  const db = getDatabase();

  for (const table of deleteOrder) {
    switch (table) {
      case "app_preferences":
        db.prepare("DELETE FROM app_preferences").run();
        break;
      case "chat_messages":
        db.prepare(
          `DELETE FROM chat_messages
           WHERE session_id IN (SELECT id FROM chat_sessions WHERE work_id = ?)`,
        ).run(workId);
        break;
      case "chapter_order":
        db.prepare(
          `DELETE FROM chapter_order
           WHERE chapter_id IN (SELECT id FROM chapters WHERE work_id = ?)`,
        ).run(workId);
        break;
      case "chapter_summaries":
        db.prepare(
          `DELETE FROM chapter_summaries
           WHERE chapter_id IN (SELECT id FROM chapters WHERE work_id = ?)`,
        ).run(workId);
        break;
      default:
        db.prepare(`DELETE FROM ${table} WHERE work_id = ?`).run(workId);
        break;
    }
  }
}

export function listSnapshots(workId = "work-default") {
  const db = getDatabase();

  return db
    .prepare(
      `SELECT id, label, created_at AS createdAt
       FROM snapshots
       WHERE work_id = ?
       ORDER BY created_at DESC`,
    )
    .all(workId) as Array<{ id: string; label: string; createdAt: string }>;
}

export function createSnapshot(options?: { workId?: string; label?: string }) {
  const workId = options?.workId ?? "work-default";
  const db = getDatabase();
  const snapshotId = randomUUID();
  const createdAt = nowIso();
  const label = options?.label ?? `Snapshot ${createdAt}`;

  const snapshotState = Object.fromEntries(
    snapshotTables.map((table) => [table, queryRows(table, workId)]),
  ) as Record<SnapshotTable, Record<string, unknown>[]>;

  db.exec("BEGIN IMMEDIATE");

  try {
    db.prepare(
      `INSERT INTO snapshots (id, work_id, label, created_at)
       VALUES (?, ?, ?, ?)`,
    ).run(snapshotId, workId, label, createdAt);

    const insertItem = db.prepare(
      `INSERT INTO snapshot_items (id, snapshot_id, item_type, item_key, payload_json)
       VALUES (?, ?, ?, ?, ?)`,
    );

    for (const [itemType, rows] of Object.entries(snapshotState)) {
      insertItem.run(
        randomUUID(),
        snapshotId,
        itemType,
        itemType,
        JSON.stringify(rows),
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    id: snapshotId,
    workId,
    label,
    createdAt,
    itemCount: Object.keys(snapshotState).length,
  };
}

export function deleteSnapshot(snapshotId: string) {
  const db = getDatabase();

  db.prepare("DELETE FROM snapshots WHERE id = ?").run(snapshotId);

  return {
    snapshotId,
    action: "delete",
  };
}

export function restoreSnapshot(snapshotId: string) {
  const db = getDatabase();
  const snapshot = db
    .prepare("SELECT id, work_id AS workId, label FROM snapshots WHERE id = ?")
    .get(snapshotId) as { id: string; workId: string; label: string } | undefined;

  if (!snapshot) {
    throw new Error(`Snapshot not found: ${snapshotId}`);
  }

  const items = db
    .prepare(
      `SELECT item_type AS itemType, payload_json AS payloadJson
       FROM snapshot_items
       WHERE snapshot_id = ?
       ORDER BY item_type ASC`,
    )
    .all(snapshotId) as Array<{ itemType: SnapshotTable; payloadJson: string }>;

  db.exec("BEGIN IMMEDIATE");

  try {
    deleteCurrentState(snapshot.workId);

    for (const table of insertOrder) {
      const item = items.find((entry) => entry.itemType === table);
      if (!item) {
        continue;
      }

      const rows = JSON.parse(item.payloadJson) as Record<string, unknown>[];
      insertRows(table, rows);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    snapshotId,
    workId: snapshot.workId,
    label: snapshot.label,
    action: "restore",
  };
}
