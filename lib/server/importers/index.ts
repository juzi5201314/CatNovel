import { importFileFormats, type ImportFileFormat } from '../../contracts/transfer.ts';

export interface ImportPayload {
  fileName: string;
  content: string;
}

export interface ParsedImportDocument {
  format: ImportFileFormat;
  title: string;
  chapters: Array<{
    title: string;
    content: string;
  }>;
}

export function detectImportFormat(fileName: string): ImportFileFormat {
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (extension && importFileFormats.includes(extension as ImportFileFormat)) {
    return extension as ImportFileFormat;
  }

  throw new Error(`Unsupported import format: ${fileName}`);
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
