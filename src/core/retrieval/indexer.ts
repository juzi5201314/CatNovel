import { ChaptersRepository } from "@/repositories/chapters-repository";

import { type ChunkVectorRecord } from "./chunk-schema";
import { chunkChapter, type ChapterChunkInput } from "./chunker";
import { embedTexts } from "./embedding";
import { LanceDbVectorStore } from "./vector-store";

export type ReindexInput = {
  projectId: string;
  chapterIds?: string[];
};

export type ReindexOutput = {
  indexedChapters: number;
  indexedChunks: number;
  lastBuildAt: string;
};

type IndexedChapter = {
  id: string;
  projectId: string;
  orderNo: number;
  content?: string;
  summary?: string | null;
  updatedAt: Date;
};

function chapterToChunkInput(chapter: IndexedChapter): ChapterChunkInput {
  return {
    projectId: chapter.projectId,
    chapterId: chapter.id,
    chapterNo: chapter.orderNo,
    content: chapter.content ?? "",
    summary: chapter.summary ?? null,
    updatedAt: chapter.updatedAt.toISOString(),
  };
}

async function withEmbeddings(
  records: Omit<ChunkVectorRecord, "vector">[],
  projectId: string,
): Promise<ChunkVectorRecord[]> {
  const vectors = await embedTexts(records.map((item) => item.text), { projectId });
  return records.map((item, index) => ({
    ...item,
    vector: vectors[index] ?? [],
  }));
}

export class RetrievalIndexer {
  constructor(
    private readonly chapterRepository = new ChaptersRepository(),
    private readonly vectorStore = new LanceDbVectorStore(),
  ) {}

  async reindex(input: ReindexInput): Promise<ReindexOutput> {
    const chapters = this.resolveChapters(input);
    let indexedChunks = 0;
    const isFullRebuild = !input.chapterIds || input.chapterIds.length === 0;

    if (isFullRebuild) {
      await this.vectorStore.deleteByProject(input.projectId);
    }

    for (const chapter of chapters) {
      if (!isFullRebuild) {
        await this.vectorStore.deleteByChapter(input.projectId, chapter.id);
      }
      const chunked = chunkChapter(chapterToChunkInput(chapter));
      if (chunked.all.length === 0) {
        continue;
      }

      const records = await withEmbeddings(chunked.all, input.projectId);
      indexedChunks += records.length;
      await this.vectorStore.upsert(records);
    }

    return {
      indexedChapters: chapters.length,
      indexedChunks,
      lastBuildAt: new Date().toISOString(),
    };
  }

  private resolveChapters(input: ReindexInput) {
    if (!input.chapterIds || input.chapterIds.length === 0) {
      return this.chapterRepository.listByProject(input.projectId);
    }

    const rows = input.chapterIds
      .map((chapterId) => this.chapterRepository.findByChapterId(chapterId))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter((row) => row.projectId === input.projectId);

    return rows.sort((left, right) => left.orderNo - right.orderNo);
  }
}
