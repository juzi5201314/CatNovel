export const projectExportFormats = ['json', 'txt', 'md', 'docx', 'epub', 'pdf'] as const;

export type ProjectExportFormat = (typeof projectExportFormats)[number];

export const chapterExportFormats = ['txt', 'md', 'docx', 'epub', 'pdf'] as const;

export type ChapterExportFormat = (typeof chapterExportFormats)[number];

export const importFileFormats = ['txt', 'md', 'epub', 'docx', 'doc', 'pdf'] as const;

export type ImportFileFormat = (typeof importFileFormats)[number];
