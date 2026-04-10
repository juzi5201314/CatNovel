export type SupportedExportFormat =
  | 'txt'
  | 'md'
  | 'docx'
  | 'epub'
  | 'pdf'
  | 'json';

export interface ExportChapter {
  title: string;
  content: string;
}

export function buildProjectExport(format: SupportedExportFormat) {
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
  format: Exclude<SupportedExportFormat, 'json'>,
  chapters: ExportChapter[],
) {
  return {
    format,
    fileName: `chapters.${format}`,
    content: chapters.map((chapter) => `${chapter.title}\n${chapter.content}`).join('\n\n'),
  };
}
