import { Type, type Static } from '@sinclair/typebox';

import { getChapterById, updateChapter } from '../../repositories/chapter-repository.ts';
import { deriveChapterMetrics } from '../../services/workspace-metrics.ts';

import type { ToolDefinition, ToolHandler } from './types.ts';

export const ApplySuggestionSchema = Type.Object({
  chapterId: Type.String({ minLength: 1, description: 'The chapter identifier to update.' }),
  suggestion: Type.String({ minLength: 1, description: 'The revision text that should be inserted into the chapter.' }),
  position: Type.Optional(
    Type.Integer({ minimum: 0, description: 'Optional character index in plaintext where the suggestion should be inserted.' }),
  ),
});

export type ApplySuggestionParams = Static<typeof ApplySuggestionSchema>;

function normalizeInsertionPosition(text: string, position?: number) {
  if (position === undefined) {
    return text.length;
  }

  return Math.min(Math.max(position, 0), text.length);
}

function insertSuggestion(text: string, suggestion: string, position?: number) {
  const normalizedSuggestion = suggestion.trim();
  const insertionPosition = normalizeInsertionPosition(text, position);

  if (!text.trim()) {
    return {
      insertionPosition: 0,
      nextPlaintext: normalizedSuggestion,
    };
  }

  if (position === undefined || insertionPosition >= text.length) {
    const separator = text.endsWith('\n') ? '\n' : '\n\n';
    return {
      insertionPosition: text.length,
      nextPlaintext: `${text}${separator}${normalizedSuggestion}`,
    };
  }

  return {
    insertionPosition,
    nextPlaintext: `${text.slice(0, insertionPosition)}${normalizedSuggestion}${text.slice(insertionPosition)}`,
  };
}

function buildBodyJsonFromPlaintext(plaintext: string) {
  const content = plaintext
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: paragraph }],
    }));

  return JSON.stringify({
    type: 'doc',
    content,
  });
}

const applySuggestionHandler: ToolHandler<ApplySuggestionParams> = async ({
  chapterId,
  suggestion,
  position,
}) => {
  const chapter = getChapterById(chapterId);

  if (!chapter) {
    throw new Error(`Unknown chapter: ${chapterId}`);
  }

  const { insertionPosition, nextPlaintext } = insertSuggestion(
    chapter.plaintext,
    suggestion,
    position,
  );
  const nextBodyJson = buildBodyJsonFromPlaintext(nextPlaintext);
  const metrics = deriveChapterMetrics(nextBodyJson);
  const updatedChapter = updateChapter(chapterId, {
    bodyJson: nextBodyJson,
    plaintext: metrics.plaintext,
    excerpt: metrics.excerpt,
    wordCount: metrics.wordCount,
    characterCount: metrics.characterCount,
    readingMinutes: metrics.readingMinutes,
    lastAutosavedAt: new Date().toISOString(),
  });

  return {
    chapterId: updatedChapter.id,
    title: updatedChapter.title,
    insertedText: suggestion.trim(),
    position: insertionPosition,
    plaintext: updatedChapter.plaintext,
    excerpt: updatedChapter.excerpt,
    wordCount: updatedChapter.wordCount,
    characterCount: updatedChapter.characterCount,
    readingMinutes: updatedChapter.readingMinutes,
    updatedAt: updatedChapter.updatedAt,
  };
};

export const applySuggestionTool: ToolDefinition = {
  name: 'apply_suggestion',
  description: 'Apply a writing suggestion to a chapter and persist refreshed metrics.',
  parameters: ApplySuggestionSchema,
  handler: applySuggestionHandler,
};
