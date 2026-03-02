import { type ChunkVectorRecord } from "./chunk-schema";
import { LanceDbVectorStore } from "./vector-store";

export type LanceDbSmokeResult = {
  inserted: number;
  hitCount: number;
  firstHitChunkId: string | null;
};

export async function runLanceDbSmoke(): Promise<LanceDbSmokeResult> {
  const store = new LanceDbVectorStore();
  const smokeChunkId = `smoke_${Date.now()}`;
  const row: ChunkVectorRecord = {
    project_id: "smoke_project",
    chapter_no: 1,
    chapter_id: "smoke_chapter_1",
    chunk_id: smokeChunkId,
    chunk_type: "summary",
    entity_ids: ["smoke_entity"],
    position_in_chapter: 0,
    updated_at: new Date().toISOString(),
    vector: [0.12, 0.88],
    text: "smoke",
  };

  await store.upsert([row]);
  const hits = await store.queryNearest({
    projectId: row.project_id,
    vector: row.vector,
    limit: 1,
  });
  await store.deleteByChunkIds(row.project_id, [row.chunk_id]);

  return {
    inserted: 1,
    hitCount: hits.length,
    firstHitChunkId: hits[0]?.chunk_id ?? null,
  };
}
