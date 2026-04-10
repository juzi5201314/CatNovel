import { randomUUID } from "node:crypto";

import { getDatabase } from "../../../db/client.ts";

export type VolumeRecord = {
  id: string;
  workId: string;
  title: string;
  sortIndex: number;
  createdAt: string;
  updatedAt: string;
};

export function listVolumes(workId: string) {
  const db = getDatabase();

  return db.prepare(
    `SELECT
      id,
      work_id AS workId,
      title,
      sort_index AS sortIndex,
      created_at AS createdAt,
      updated_at AS updatedAt
     FROM volumes
     WHERE work_id = ?
     ORDER BY sort_index ASC, created_at ASC`,
  ).all(workId) as VolumeRecord[];
}

export function getVolumeById(volumeId: string) {
  const db = getDatabase();

  return db.prepare(
    `SELECT
      id,
      work_id AS workId,
      title,
      sort_index AS sortIndex,
      created_at AS createdAt,
      updated_at AS updatedAt
     FROM volumes
     WHERE id = ?`,
  ).get(volumeId) as VolumeRecord | undefined;
}

export function createVolume(input: { workId: string; title: string }) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const volumeId = randomUUID();
  const orderRow = db
    .prepare(
      "SELECT COALESCE(MAX(sort_index), -1) + 1 AS nextIndex FROM volumes WHERE work_id = ?",
    )
    .get(input.workId) as { nextIndex: number };

  db.prepare(
    `INSERT INTO volumes (id, work_id, title, sort_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(volumeId, input.workId, input.title, orderRow.nextIndex, now, now);

  return getVolumeById(volumeId) as VolumeRecord;
}

export function updateVolume(
  volumeId: string,
  updates: Partial<Pick<VolumeRecord, "title" | "sortIndex">>,
) {
  const current = getVolumeById(volumeId);

  if (!current) {
    throw new Error(`Unknown volume: ${volumeId}`);
  }

  const next = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const db = getDatabase();
  db.prepare(
    `UPDATE volumes
       SET title = ?,
           sort_index = ?,
           updated_at = ?
     WHERE id = ?`,
  ).run(next.title, next.sortIndex, next.updatedAt, volumeId);

  return getVolumeById(volumeId) as VolumeRecord;
}

export function deleteVolume(volumeId: string) {
  const db = getDatabase();
  const volume = getVolumeById(volumeId);

  if (!volume) {
    return;
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM chapter_order WHERE chapter_id IN (SELECT id FROM chapters WHERE volume_id = ?)")
      .run(volumeId);
    db.prepare("DELETE FROM chapters WHERE volume_id = ?").run(volumeId);
    db.prepare("DELETE FROM volumes WHERE id = ?").run(volumeId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
