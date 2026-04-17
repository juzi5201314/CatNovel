import { randomUUID } from 'node:crypto';

import { getDatabase } from '../../../db/client.ts';

export type ContextSelectionSourceType = 'chat-session';

type ContextSelectionRow = {
  id: string;
  workId: string;
  chapterId: string | null;
  sourceType: string;
  sourceId: string;
  createdAt: string;
};

function hydrateContextSelection(row: ContextSelectionRow) {
  return {
    workId: row.workId,
    chapterId: row.chapterId,
  };
}

export function getContextSelectionBySource(
  sourceType: ContextSelectionSourceType,
  sourceId: string,
): { workId: string; chapterId: string | null } | null {
  const row = getDatabase()
    .prepare(
      `SELECT
        id,
        work_id AS workId,
        chapter_id AS chapterId,
        source_type AS sourceType,
        source_id AS sourceId,
        created_at AS createdAt
      FROM context_selections
      WHERE source_type = ? AND source_id = ?`,
    )
    .get(sourceType, sourceId) as ContextSelectionRow | undefined;

  if (!row) {
    return null;
  }

  return hydrateContextSelection(row);
}

export function upsertContextSelectionBySource(input: {
  workId: string;
  chapterId: string | null;
  sourceType: ContextSelectionSourceType;
  sourceId: string;
}): { workId: string; chapterId: string | null } {
  const existing = getContextSelectionBySource(input.sourceType, input.sourceId);

  if (existing) {
    getDatabase()
      .prepare(
        `UPDATE context_selections
         SET work_id = ?, chapter_id = ?, created_at = ?
         WHERE source_type = ? AND source_id = ?`,
      )
      .run(
        input.workId,
        input.chapterId,
        new Date().toISOString(),
        input.sourceType,
        input.sourceId,
      );
  } else {
    const id = randomUUID();
    getDatabase()
      .prepare(
        `INSERT INTO context_selections (id, work_id, chapter_id, source_type, source_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.workId,
        input.chapterId,
        input.sourceType,
        input.sourceId,
        new Date().toISOString(),
      );
  }

  return { workId: input.workId, chapterId: input.chapterId };
}
