import { getDatabase } from '../../../db/client.ts';

type ChapterSummaryRow = {
  chapterId: string;
  summary: string;
  updatedAt: string;
};

export function getChapterSummary(chapterId: string): {
  chapterId: string;
  summary: string;
  updatedAt: string;
} | null {
  const row = getDatabase()
    .prepare(
      `SELECT
        chapter_id AS chapterId,
        summary,
        updated_at AS updatedAt
      FROM chapter_summaries
      WHERE chapter_id = ?`,
    )
    .get(chapterId) as ChapterSummaryRow | undefined;

  if (!row) {
    return null;
  }

  return {
    chapterId: row.chapterId,
    summary: row.summary,
    updatedAt: row.updatedAt,
  };
}

export function upsertChapterSummary(input: {
  chapterId: string;
  summary: string;
}): { chapterId: string; summary: string; updatedAt: string } {
  const now = new Date().toISOString();
  const existing = getChapterSummary(input.chapterId);

  if (existing) {
    getDatabase()
      .prepare(
        `UPDATE chapter_summaries
         SET summary = ?, updated_at = ?
         WHERE chapter_id = ?`,
      )
      .run(input.summary, now, input.chapterId);
  } else {
    getDatabase()
      .prepare(
        `INSERT INTO chapter_summaries (chapter_id, summary, updated_at)
         VALUES (?, ?, ?)`,
      )
      .run(input.chapterId, input.summary, now);
  }

  return {
    chapterId: input.chapterId,
    summary: input.summary,
    updatedAt: now,
  };
}
