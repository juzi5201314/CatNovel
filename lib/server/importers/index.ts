export type SupportedImportFormat =
  | 'txt'
  | 'md'
  | 'epub'
  | 'docx'
  | 'doc'
  | 'pdf';

export interface ImportPayload {
  fileName: string;
  content: string;
}

export interface ParsedImportDocument {
  format: SupportedImportFormat;
  title: string;
  chapters: Array<{
    title: string;
    content: string;
  }>;
}

export function detectImportFormat(fileName: string): SupportedImportFormat {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'txt':
    case 'md':
    case 'epub':
    case 'docx':
    case 'doc':
    case 'pdf':
      return extension;
    default:
      throw new Error(`Unsupported import format: ${fileName}`);
  }
}

export function parseImportFile(payload: ImportPayload): ParsedImportDocument {
  const format = detectImportFormat(payload.fileName);

  return {
    format,
    title: payload.fileName.replace(/\.[^.]+$/, ''),
    chapters: [
      {
        title: `${format.toUpperCase()} import`,
        content: payload.content,
      },
    ],
  };
}
