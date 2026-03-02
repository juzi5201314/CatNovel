export const CHUNK_TABLE_NAME = "novel_chunks";

export type ChunkType = "content" | "lore" | "summary" | "event";

export type ChunkMetadata = {
  project_id: string;
  chapter_no: number;
  chapter_id: string;
  chunk_id: string;
  chunk_type: ChunkType;
  entity_ids: string[];
  position_in_chapter: number;
  updated_at: string;
};

export type ChunkVectorRecord = ChunkMetadata & {
  vector: number[];
  text: string;
};

export type VectorSearchHit = ChunkVectorRecord & {
  score: number;
};

const QUOTE = /'/g;

export function sanitizeSqlString(raw: string): string {
  return raw.replace(QUOTE, "''");
}

export function buildChunkIdInFilter(chunkIds: string[]): string {
  if (chunkIds.length === 0) {
    return "1 = 0";
  }

  const values = chunkIds.map((chunkId) => `'${sanitizeSqlString(chunkId)}'`);
  return `chunk_id IN (${values.join(", ")})`;
}

export function buildProjectFilter(projectId: string): string {
  return `project_id = '${sanitizeSqlString(projectId)}'`;
}

