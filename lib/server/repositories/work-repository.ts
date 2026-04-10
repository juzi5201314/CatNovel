import { randomUUID } from "node:crypto";

import { getDatabase } from "../../../db/client.ts";

export type WorkRecord = {
  id: string;
  title: string;
  locale: "zh" | "en" | "ru";
  synopsis: string;
  createdAt: string;
  updatedAt: string;
};

export function listWorks() {
  const db = getDatabase();

  return db.prepare(
    `SELECT
      id,
      title,
      locale,
      synopsis,
      created_at AS createdAt,
      updated_at AS updatedAt
     FROM works
     ORDER BY updated_at DESC`,
  ).all() as WorkRecord[];
}

export function getWorkById(workId: string) {
  const db = getDatabase();

  return db.prepare(
    `SELECT
      id,
      title,
      locale,
      synopsis,
      created_at AS createdAt,
      updated_at AS updatedAt
     FROM works
     WHERE id = ?`,
  ).get(workId) as WorkRecord | undefined;
}

export function createWork(input: {
  title: string;
  locale: WorkRecord["locale"];
  synopsis?: string;
}) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const workId = randomUUID();

  db.prepare(
    `INSERT INTO works (id, title, locale, synopsis, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(workId, input.title, input.locale, input.synopsis ?? "", now, now);

  return getWorkById(workId) as WorkRecord;
}

export function updateWork(
  workId: string,
  updates: Partial<Pick<WorkRecord, "title" | "locale" | "synopsis">>,
) {
  const current = getWorkById(workId);

  if (!current) {
    throw new Error(`Unknown work: ${workId}`);
  }

  const next = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const db = getDatabase();
  db.prepare(
    `UPDATE works
       SET title = ?,
           locale = ?,
           synopsis = ?,
           updated_at = ?
     WHERE id = ?`,
  ).run(next.title, next.locale, next.synopsis, next.updatedAt, workId);

  return getWorkById(workId) as WorkRecord;
}

export function deleteWork(workId: string) {
  const db = getDatabase();
  const countRow = db
    .prepare("SELECT COUNT(*) AS count FROM works")
    .get() as { count: number };

  if (countRow.count <= 1) {
    throw new Error("Cannot delete the last remaining work");
  }

  db.prepare("DELETE FROM works WHERE id = ?").run(workId);
}
