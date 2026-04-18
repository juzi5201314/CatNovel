import type { BootstrapPayload } from '@/lib/contracts/bootstrap';
import type {
  ChapterExportFormat,
  ImportFileFormat,
  ProjectExportFormat,
} from '@/lib/contracts/transfer';
import type { WorkspaceCollections } from '@/lib/contracts/workspace';

export type WorkspaceBootstrapResponse = {
  bootstrap: BootstrapPayload;
  collections: WorkspaceCollections;
};

export type WorkspaceMutationResponse = WorkspaceBootstrapResponse & {
  ok?: boolean;
  result?: unknown;
};

export type WorkspaceMutationOptions = {
  preserveEditor?: boolean;
  chapterId?: string | null;
  sessionId?: string | null;
};

export type ExportPayloadResponse = {
  exportPayload: {
    format: ProjectExportFormat | ChapterExportFormat;
    fileName: string;
    content: string;
  };
};

export type ImportParseResponse = {
  parsedDocument: {
    format: ImportFileFormat;
  };
};

export type SnapshotListItem = {
  id: string;
  label: string;
  createdAt: string;
};
