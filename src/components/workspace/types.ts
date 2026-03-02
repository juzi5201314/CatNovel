export type ProjectMode = "webnovel" | "literary" | "screenplay";

export type ProjectItem = {
  id: string;
  name: string;
  mode: ProjectMode;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type ChapterItem = {
  id: string;
  projectId: string;
  orderNo: number;
  title: string;
  content: string;
  summary?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type ApiErrorShape = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: ApiErrorShape;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type ImportStage = "validation" | "parser" | "persistence" | "configuration";

export type ImportIssue = {
  code: string;
  message: string;
  recoverable: boolean;
  hint: string;
  target?: string;
  details?: unknown;
};

export type ImportErrorReport = {
  stage: ImportStage;
  recoverable: boolean;
  hint: string;
  issues: ImportIssue[];
};

export type ProjectImportResult = {
  project: ProjectItem;
  importedChapters: number;
  sourceProjectId: string | null;
};

export type ProjectSnapshotSummary = {
  id: string;
  projectId: string;
  sourceChapterId: string | null;
  sourceSnapshotId: string | null;
  triggerType: string;
  triggerReason: string;
  chapterCount: number;
  timelineEventCount: number;
  timelineSummary: string;
  createdAt: string;
  updatedAt: string;
};

export type SnapshotTextDiffLine = {
  op: "equal" | "add" | "remove";
  text: string;
};

export type SnapshotChapterDiff = {
  chapterId: string;
  chapterTitleBefore: string | null;
  chapterTitleAfter: string | null;
  orderNoBefore: number | null;
  orderNoAfter: number | null;
  changeType: "added" | "removed" | "modified" | "unchanged";
  diffLines: SnapshotTextDiffLine[];
};

export type SnapshotTimelineDiff = {
  beforeSummary: string;
  afterSummary: string;
  beforeEventCount: number;
  afterEventCount: number;
  diffLines: SnapshotTextDiffLine[];
};

export type ProjectSnapshotDiff = {
  beforeSnapshot: {
    id: string;
    triggerType: string;
    triggerReason: string;
    createdAt: string;
    chapterCount: number;
    timelineEventCount: number;
  };
  afterSnapshot: {
    id: string;
    triggerType: string;
    triggerReason: string;
    createdAt: string;
    chapterCount: number;
    timelineEventCount: number;
  };
  chapters: SnapshotChapterDiff[];
  timeline: SnapshotTimelineDiff;
};

export type SnapshotRestoreResult = {
  restoredFromSnapshotId: string;
  backupSnapshotId: string;
  restoredSnapshotId: string;
  restoredChapterCount: number;
  restoredEntityCount: number;
  restoredEventCount: number;
  restoredEventEntityCount: number;
};

export type ChapterSaveResponse = {
  chapter: ChapterItem;
  autoSnapshot: {
    created: boolean;
    snapshotId: string | null;
    reason: string;
    elapsedMs: number | null;
    deltaChars: number;
  };
  timelineRecompute: {
    lowConfidenceEvents: number;
    diffReport: {
      added: number;
      updated: number;
      removed: number;
      impacted: number;
    };
    conflictReport: {
      hasConflicts: boolean;
      total: number;
      byCode: {
        time_order_conflict: number;
        duplicate_event: number;
        entity_conflict: number;
      };
    };
  } | null;
  timelineRecomputeError: string | null;
};
