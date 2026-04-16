import { getDatabase } from '../../../db/client.ts';

export type WorkspaceOverview = {
  workId: string;
  title: string;
  locale: string;
  synopsis: string;
  chapterCount: number;
  volumeCount: number;
  totalWords: number;
  totalCharacters: number;
  totalReadingMinutes: number;
  lastAutosavedAt: string | null;
};

export function getWorkspaceOverview(workId?: string): WorkspaceOverview {
  const db = getDatabase();
  const overviewQuery = `WITH volume_stats AS (
      SELECT work_id AS workId, COUNT(*) AS volumeCount
      FROM volumes
      GROUP BY work_id
    ),
    chapter_stats AS (
      SELECT
        work_id AS workId,
        COUNT(*) AS chapterCount,
        COALESCE(SUM(word_count), 0) AS totalWords,
        COALESCE(SUM(character_count), 0) AS totalCharacters,
        COALESCE(SUM(reading_minutes), 0) AS totalReadingMinutes,
        MAX(last_autosaved_at) AS lastAutosavedAt
      FROM chapters
      GROUP BY work_id
    )
    SELECT
      w.id AS workId,
      w.title AS title,
      w.locale AS locale,
      w.synopsis AS synopsis,
      COALESCE(vs.volumeCount, 0) AS volumeCount,
      COALESCE(cs.chapterCount, 0) AS chapterCount,
      COALESCE(cs.totalWords, 0) AS totalWords,
      COALESCE(cs.totalCharacters, 0) AS totalCharacters,
      COALESCE(cs.totalReadingMinutes, 0) AS totalReadingMinutes,
      cs.lastAutosavedAt AS lastAutosavedAt
    FROM works w
    LEFT JOIN volume_stats vs ON vs.workId = w.id
    LEFT JOIN chapter_stats cs ON cs.workId = w.id`;

  if (workId) {
    return db.prepare(
      `${overviewQuery}
      WHERE w.id = ?`,
    ).get(workId) as WorkspaceOverview;
  }

  return db.prepare(
    `${overviewQuery}
    ORDER BY w.created_at ASC
    LIMIT 1`,
  ).get() as WorkspaceOverview;
}

export function listWorkspaceChapters(workId: string) {
  const db = getDatabase();

  return db.prepare(
    `SELECT
       c.id,
       c.volume_id AS volumeId,
       c.title,
       c.excerpt,
       c.updated_at AS updatedAt,
       c.word_count AS wordCount,
       c.character_count AS characterCount,
       c.reading_minutes AS readingMinutes,
       c.last_autosaved_at AS lastAutosavedAt
     FROM chapters c
     INNER JOIN chapter_order o ON o.chapter_id = c.id
     WHERE c.work_id = ?
     ORDER BY o.sort_index ASC`,
  ).all(workId) as Array<{
    id: string;
    volumeId: string;
    title: string;
    excerpt: string;
    updatedAt: string;
    wordCount: number;
    characterCount: number;
    readingMinutes: number;
    lastAutosavedAt: string | null;
  }>;
}

export function listWorkspaceVolumes(workId: string) {
  const db = getDatabase();

  return db.prepare(
    `SELECT
      v.id AS id,
      v.title AS title,
      COUNT(c.id) AS chapterCount,
      COALESCE(SUM(c.word_count), 0) AS totalWords
    FROM volumes v
    LEFT JOIN chapters c ON c.volume_id = v.id
    WHERE v.work_id = ?
    GROUP BY v.id, v.title, v.sort_index
    ORDER BY v.sort_index ASC, v.created_at ASC`,
  ).all(workId) as Array<{
    id: string;
    title: string;
    chapterCount: number;
    totalWords: number;
  }>;
}
