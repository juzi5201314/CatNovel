import { getDatabase } from "@/db/client";

export type WorkspaceOverview = {
  workId: string;
  title: string;
  locale: string;
  chapterCount: number;
};

export function getWorkspaceOverview(): WorkspaceOverview {
  const db = getDatabase();

  return db.prepare(
    `SELECT
      w.id AS workId,
      w.title AS title,
      w.locale AS locale,
      COUNT(c.id) AS chapterCount
    FROM works w
    LEFT JOIN chapters c ON c.work_id = w.id
    GROUP BY w.id, w.title, w.locale
    ORDER BY w.created_at ASC
    LIMIT 1`,
  ).get() as WorkspaceOverview;
}

export function listWorkspaceChapters(workId: string) {
  const db = getDatabase();

  return db.prepare(
    `SELECT c.id, c.volume_id AS volumeId, c.title, c.excerpt, c.updated_at AS updatedAt, c.word_count AS wordCount
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
  }>;
}

export function listWorkspaceVolumes(workId: string) {
  const db = getDatabase();

  return db.prepare(
    `SELECT
      volume_id AS id,
      CASE volume_id
        WHEN 'volume-1' THEN '第一卷 迷雾城'
        ELSE volume_id
      END AS title,
      COUNT(*) AS chapterCount
    FROM chapters
    WHERE work_id = ?
    GROUP BY volume_id
    ORDER BY MIN(created_at) ASC`,
  ).all(workId) as Array<{
    id: string;
    title: string;
    chapterCount: number;
  }>;
}
