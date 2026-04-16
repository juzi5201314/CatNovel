import { Type, type Static } from '@sinclair/typebox';

import { getChapterById } from '../../repositories/chapter-repository.ts';

import type { ToolDefinition, ToolHandler } from './types.ts';

export const ReadChapterSchema = Type.Object({
  chapterId: Type.String({ minLength: 1, description: 'The chapter identifier to read.' }),
});

export type ReadChapterParams = Static<typeof ReadChapterSchema>;

const readChapterHandler: ToolHandler<ReadChapterParams> = async ({ chapterId }) => {
  const chapter = getChapterById(chapterId);

  if (!chapter) {
    throw new Error(`Unknown chapter: ${chapterId}`);
  }

  return {
    id: chapter.id,
    workId: chapter.workId,
    volumeId: chapter.volumeId,
    title: chapter.title,
    plaintext: chapter.plaintext,
    excerpt: chapter.excerpt,
    bodyJson: chapter.bodyJson,
    wordCount: chapter.wordCount,
    characterCount: chapter.characterCount,
    readingMinutes: chapter.readingMinutes,
    status: chapter.status,
    lastAutosavedAt: chapter.lastAutosavedAt,
    updatedAt: chapter.updatedAt,
  };
};

export const readChapterTool: ToolDefinition = {
  name: 'read_chapter',
  description: 'Read a chapter title, content, and metrics for writing context.',
  parameters: ReadChapterSchema,
  handler: readChapterHandler,
};
