import type { ChapterExportFormat, ProjectExportFormat } from '../../contracts/transfer.ts';

export interface ExportChapter {
  title: string;
  content: string;
}

export function buildProjectExport(format: ProjectExportFormat) {
  return {
    format,
    fileName: `catnovel-project.${format}`,
    content:
      format === 'json'
        ? JSON.stringify({ format: 'project-json', chapters: [] }, null, 2)
        : `export:${format}`,
  };
}

export function buildChapterBatchExport(
  format: ChapterExportFormat,
  chapters: ExportChapter[],
) {
  return {
    format,
    fileName: `chapters.${format}`,
    content: chapters.map((chapter) => `${chapter.title}\n${chapter.content}`).join('\n\n'),
  };
}
