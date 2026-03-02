import { LanceDbClient, type LanceDbClientOptions } from "./lancedb-client";
import {
  buildChunkIdInFilter,
  buildProjectFilter,
  sanitizeSqlString,
  type ChunkVectorRecord,
  type VectorSearchHit,
} from "./chunk-schema";

export type VectorQueryInput = {
  projectId: string;
  vector: number[];
  limit?: number;
};

export type ChapterScope = {
  from?: number;
  to?: number;
};

export class LanceDbVectorStore {
  private readonly client: LanceDbClient;

  constructor(options: LanceDbClientOptions = {}) {
    this.client = new LanceDbClient(options);
  }

  // upsert 通过「先删后插」实现，行为可预测且易审计。
  async upsert(records: ChunkVectorRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    const table = await this.client.getOrCreateTable(records);
    const groupedChunkIds = new Map<string, Set<string>>();

    for (const record of records) {
      if (!groupedChunkIds.has(record.project_id)) {
        groupedChunkIds.set(record.project_id, new Set<string>());
      }
      groupedChunkIds.get(record.project_id)!.add(record.chunk_id);
    }

    for (const [projectId, chunkIds] of groupedChunkIds.entries()) {
      const predicate = `${buildProjectFilter(projectId)} AND ${buildChunkIdInFilter(
        [...chunkIds],
      )}`;
      await table.delete(predicate);
    }

    await table.add(records, { mode: "append" });
  }

  async queryNearest(
    input: VectorQueryInput,
    chapterScope?: ChapterScope,
  ): Promise<VectorSearchHit[]> {
    const table = await this.client.openTableIfExists();
    if (!table) {
      return [];
    }

    const limit = input.limit ?? 10;
    const filters = [buildProjectFilter(input.projectId)];
    if (chapterScope?.from !== undefined) {
      filters.push(`chapter_no >= ${chapterScope.from}`);
    }
    if (chapterScope?.to !== undefined) {
      filters.push(`chapter_no <= ${chapterScope.to}`);
    }

    const rows = (await table
      .search(input.vector)
      .where(filters.join(" AND "))
      .limit(limit)
      .select([
        "project_id",
        "chapter_no",
        "chapter_id",
        "chunk_id",
        "chunk_type",
        "entity_ids",
        "position_in_chapter",
        "updated_at",
        "vector",
        "text",
        "_distance",
      ])
      .toArray()) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      project_id: String(row.project_id),
      chapter_no: Number(row.chapter_no),
      chapter_id: String(row.chapter_id),
      chunk_id: String(row.chunk_id),
      chunk_type: String(row.chunk_type) as ChunkVectorRecord["chunk_type"],
      entity_ids: Array.isArray(row.entity_ids)
        ? row.entity_ids.map((item: unknown) => String(item))
        : [],
      position_in_chapter: Number(row.position_in_chapter),
      updated_at: String(row.updated_at),
      vector: Array.isArray(row.vector)
        ? row.vector.map((item: unknown) => Number(item))
        : [],
      text: String(row.text ?? ""),
      score: Number(row._distance ?? 0),
    }));
  }

  async deleteByChunkIds(projectId: string, chunkIds: string[]): Promise<void> {
    if (chunkIds.length === 0) {
      return;
    }

    const table = await this.client.openTableIfExists();
    if (!table) {
      return;
    }

    const predicate = `${buildProjectFilter(projectId)} AND ${buildChunkIdInFilter(
      chunkIds,
    )}`;
    await table.delete(predicate);
  }

  async deleteByProject(projectId: string): Promise<void> {
    const table = await this.client.openTableIfExists();
    if (!table) {
      return;
    }
    await table.delete(buildProjectFilter(projectId));
  }

  async deleteByChapter(projectId: string, chapterId: string): Promise<void> {
    const table = await this.client.openTableIfExists();
    if (!table) {
      return;
    }

    const predicate = `${buildProjectFilter(
      projectId,
    )} AND chapter_id = '${sanitizeSqlString(chapterId)}'`;
    await table.delete(predicate);
  }
}
