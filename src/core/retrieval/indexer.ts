import { ChaptersRepository } from "@/repositories/chapters-repository";

import { type ChunkVectorRecord } from "./chunk-schema";
import { chunkChapter, type ChapterChunkInput } from "./chunker";
import { embedTexts } from "./embedding";
import { getProjectChunks, replaceProjectChunks } from "./runtime";

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

function withEmbeddings(records: Omit<ChunkVectorRecord, "vector">[]): ChunkVectorRecord[] {
  const vectors = embedTexts(records.map((item) => item.text));
  return records.map((item, index) => ({
    ...item,
    vector: vectors[index] ?? [],
  }));
}

export class RetrievalIndexer {
  constructor(
    private readonly chapterRepository = new ChaptersRepository(),
  ) {}

  async reindex(input: ReindexInput): Promise<ReindexOutput> {
    const chapters = this.resolveChapters(input);
    const projectChunks = getProjectChunks(input.projectId);
    const nextChunks = [...projectChunks];
    let indexedChunks = 0;

    for (const chapter of chapters) {
      for (let index = nextChunks.length - 1; index >= 0; index -= 1) {
        if (nextChunks[index].chapter_id === chapter.id) {
          nextChunks.splice(index, 1);
        }
      }

      const chunked = chunkChapter(chapterToChunkInput(chapter));
      const records = withEmbeddings(chunked.all);
      indexedChunks += records.length;

      nextChunks.push(...records);
    }

    replaceProjectChunks(input.projectId, nextChunks);

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
