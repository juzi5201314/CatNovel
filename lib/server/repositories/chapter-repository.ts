import { randomUUID } from "node:crypto";

import { getDatabase } from "../../../db/client.ts";

export type ChapterRecord = {
  id: string;
  workId: string;
  volumeId: string;
  title: string;
  bodyJson: string;
  plaintext: string;
  excerpt: string;
  wordCount: number;
  characterCount: number;
  readingMinutes: number;
  status: string;
  lastAutosavedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function listChapters(workId: string) {
  const db = getDatabase();

  return db.prepare(
    `SELECT
      c.id,
      c.work_id AS workId,
      c.volume_id AS volumeId,
      c.title,
      c.body_json AS bodyJson,
      c.plaintext,
      c.excerpt,
      c.word_count AS wordCount,
      c.character_count AS characterCount,
      c.reading_minutes AS readingMinutes,
      c.status,
      c.last_autosaved_at AS lastAutosavedAt,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt
     FROM chapters c
     INNER JOIN chapter_order o ON o.chapter_id = c.id
     WHERE c.work_id = ?
     ORDER BY o.sort_index ASC`,
  ).all(workId) as ChapterRecord[];
}

export function getChapterById(chapterId: string) {
  const db = getDatabase();

  return db.prepare(
    `SELECT
      id,
      work_id AS workId,
      volume_id AS volumeId,
      title,
      body_json AS bodyJson,
      plaintext,
      excerpt,
      word_count AS wordCount,
      character_count AS characterCount,
      reading_minutes AS readingMinutes,
      status,
      last_autosaved_at AS lastAutosavedAt,
      created_at AS createdAt,
      updated_at AS updatedAt
     FROM chapters
     WHERE id = ?`,
  ).get(chapterId) as ChapterRecord | undefined;
}

export function createChapter(input: {
  workId: string;
  volumeId: string;
  title: string;
  bodyJson: string;
  plaintext: string;
  excerpt: string;
  wordCount: number;
  characterCount: number;
  readingMinutes: number;
}) {
  const db = getDatabase();
  const chapterId = randomUUID();
  const now = new Date().toISOString();
  const orderRow = db
    .prepare(
      "SELECT COALESCE(MAX(sort_index), -1) + 1 AS nextIndex FROM chapter_order WHERE work_id = ?",
    )
    .get(input.workId) as { nextIndex: number };

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `INSERT INTO chapters (
         id,
         work_id,
         volume_id,
         title,
         body_json,
         plaintext,
         excerpt,
         word_count,
         character_count,
         reading_minutes,
         status,
         last_autosaved_at,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
    ).run(
      chapterId,
      input.workId,
      input.volumeId,
      input.title,
      input.bodyJson,
      input.plaintext,
      input.excerpt,
      input.wordCount,
      input.characterCount,
      input.readingMinutes,
      now,
      now,
      now,
    );
    db.prepare(
      "INSERT INTO chapter_order (work_id, chapter_id, sort_index) VALUES (?, ?, ?)",
    ).run(input.workId, chapterId, orderRow.nextIndex);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return getChapterById(chapterId) as ChapterRecord;
}

export function updateChapter(
  chapterId: string,
  updates: Partial<
    Pick<
      ChapterRecord,
      | "title"
      | "volumeId"
      | "bodyJson"
      | "plaintext"
      | "excerpt"
      | "wordCount"
      | "characterCount"
      | "readingMinutes"
      | "status"
      | "lastAutosavedAt"
    >
  >,
) {
  const current = getChapterById(chapterId);

  if (!current) {
    throw new Error(`Unknown chapter: ${chapterId}`);
  }

  const next = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const db = getDatabase();
  db.prepare(
    `UPDATE chapters
       SET volume_id = ?,
           title = ?,
           body_json = ?,
           plaintext = ?,
           excerpt = ?,
           word_count = ?,
           character_count = ?,
           reading_minutes = ?,
           status = ?,
           last_autosaved_at = ?,
           updated_at = ?
     WHERE id = ?`,
  ).run(
    next.volumeId,
    next.title,
    next.bodyJson,
    next.plaintext,
    next.excerpt,
    next.wordCount,
    next.characterCount,
    next.readingMinutes,
    next.status,
    next.lastAutosavedAt,
    next.updatedAt,
    chapterId,
  );

  return getChapterById(chapterId) as ChapterRecord;
}

export function deleteChapter(chapterId: string) {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM chapter_order WHERE chapter_id = ?").run(chapterId);
    db.prepare("DELETE FROM chapters WHERE id = ?").run(chapterId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
