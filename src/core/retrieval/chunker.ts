import type { ChunkType, ChunkVectorRecord } from "./chunk-schema";
import {
  DEFAULT_FINE_CHUNK_OVERLAP,
  DEFAULT_FINE_CHUNK_SIZE,
  DEFAULT_SUMMARY_CHUNK_SIZE,
} from "./default-params";

export type ChapterChunkInput = {
  projectId: string;
  chapterId: string;
  chapterNo: number;
  content: string;
  summary?: string | null;
  updatedAt: string;
};

export type ChapterChunkResult = {
  fineGrained: Omit<ChunkVectorRecord, "vector">[];
  coarseGrained: Omit<ChunkVectorRecord, "vector">[];
  all: Omit<ChunkVectorRecord, "vector">[];
};

type BuildChunkArgs = {
  chunkId: string;
  chunkType: ChunkType;
  positionInChapter: number;
  text: string;
};

function buildChunkRecord(
  chapter: ChapterChunkInput,
  args: BuildChunkArgs,
): Omit<ChunkVectorRecord, "vector"> {
  return {
    project_id: chapter.projectId,
    chapter_no: chapter.chapterNo,
    chapter_id: chapter.chapterId,
    chunk_id: args.chunkId,
    chunk_type: args.chunkType,
    entity_ids: [],
    position_in_chapter: args.positionInChapter,
    updated_at: chapter.updatedAt,
    text: args.text,
  };
}

function splitByWindow(text: string, size: number, overlap: number): string[] {
  if (text.length === 0) {
    return [];
  }
  if (text.length <= size) {
    return [text];
  }

  const chunks: string[] = [];
  const step = Math.max(1, size - overlap);
  for (let start = 0; start < text.length; start += step) {
    const end = Math.min(text.length, start + size);
    const part = text.slice(start, end).trim();
    if (part.length > 0) {
      chunks.push(part);
    }
    if (end >= text.length) {
      break;
    }
  }
  return chunks;
}

function buildCoarseText(chapter: ChapterChunkInput): string {
  const source = chapter.summary?.trim() || chapter.content.trim();
  if (source.length <= DEFAULT_SUMMARY_CHUNK_SIZE) {
    return source;
  }
  return source.slice(0, DEFAULT_SUMMARY_CHUNK_SIZE);
}

export function chunkChapter(
  chapter: ChapterChunkInput,
  options?: {
    fineChunkSize?: number;
    fineChunkOverlap?: number;
  },
): ChapterChunkResult {
  const fineSize = options?.fineChunkSize ?? DEFAULT_FINE_CHUNK_SIZE;
  const fineOverlap = options?.fineChunkOverlap ?? DEFAULT_FINE_CHUNK_OVERLAP;

  const fineTexts = splitByWindow(chapter.content.trim(), fineSize, fineOverlap);
  const fineGrained = fineTexts.map((text, index) =>
    buildChunkRecord(chapter, {
      chunkId: `${chapter.chapterId}:fine:${index + 1}`,
      chunkType: "content",
      positionInChapter: index + 1,
      text,
    }),
  );

  const coarseText = buildCoarseText(chapter);
  const coarseGrained =
    coarseText.length > 0
      ? [
          buildChunkRecord(chapter, {
            chunkId: `${chapter.chapterId}:coarse:1`,
            chunkType: "summary",
            positionInChapter: 0,
            text: coarseText,
          }),
        ]
      : [];

  return {
    fineGrained,
    coarseGrained,
    all: [...coarseGrained, ...fineGrained],
  };
}
