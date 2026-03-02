import { PROJECT_MODES, type ProjectMode } from "@/db/schema";

import type { ValidationResult } from "./validators";

export const PROJECT_EXPORT_SCHEMA_VERSION = "catnovel.project-export.v1";
export const SUPPORTED_CHAPTER_IMPORT_FORMATS = ["docx", "pdf", "epub"] as const;

export type SupportedChapterImportFormat = (typeof SUPPORTED_CHAPTER_IMPORT_FORMATS)[number];
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

export type ProjectImportChapterInput = {
  title: string;
  content: string;
  summary: string | null;
  orderNo: number;
};

export type ProjectJsonImportInput = {
  projectName: string;
  projectMode: ProjectMode;
  sourceProjectId?: string;
  chapters: ProjectImportChapterInput[];
};

export type ChapterFileImportInput = {
  files: Array<{
    file: File;
    format: SupportedChapterImportFormat;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSupportedProjectMode(value: unknown): value is ProjectMode {
  return typeof value === "string" && PROJECT_MODES.includes(value as ProjectMode);
}

function extractChapterOrder(rawChapter: Record<string, unknown>, fallbackOrderNo: number): number {
  const orderNo = rawChapter.orderNo ?? rawChapter.order;
  if (orderNo === undefined) {
    return fallbackOrderNo;
  }
  if (!Number.isInteger(orderNo) || (orderNo as number) < 1) {
    throw new Error("orderNo must be an integer greater than 0");
  }
  return orderNo as number;
}

export function createImportErrorReport(input: {
  stage: ImportStage;
  hint: string;
  issues: ImportIssue[];
  recoverable?: boolean;
}): ImportErrorReport {
  return {
    stage: input.stage,
    hint: input.hint,
    issues: input.issues,
    recoverable: input.recoverable ?? input.issues.every((issue) => issue.recoverable),
  };
}

export function validateProjectJsonImportPayload(
  payload: unknown,
): ValidationResult<ProjectJsonImportInput> {
  if (!isRecord(payload)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Body must be an object",
    };
  }

  if (payload.schemaVersion !== PROJECT_EXPORT_SCHEMA_VERSION) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: `schemaVersion must be ${PROJECT_EXPORT_SCHEMA_VERSION}`,
    };
  }

  if (!isRecord(payload.project)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "project must be an object",
    };
  }

  const rawProject = payload.project;
  if (!isNonEmptyString(rawProject.name)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "project.name must be a non-empty string",
    };
  }

  if (!isSupportedProjectMode(rawProject.mode)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "project.mode must be one of webnovel/literary/screenplay",
    };
  }

  if (!Array.isArray(payload.chapters)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "chapters must be an array",
    };
  }

  const normalizedChapters: Array<ProjectImportChapterInput & { index: number }> = [];
  for (let index = 0; index < payload.chapters.length; index += 1) {
    const chapter = payload.chapters[index];
    if (!isRecord(chapter)) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: `chapters[${index}] must be an object`,
      };
    }

    if (!isNonEmptyString(chapter.title)) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: `chapters[${index}].title must be a non-empty string`,
      };
    }

    const content = chapter.content;
    if (content !== undefined && typeof content !== "string") {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: `chapters[${index}].content must be string when provided`,
      };
    }

    const summary = chapter.summary;
    if (summary !== undefined && summary !== null && typeof summary !== "string") {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: `chapters[${index}].summary must be string or null when provided`,
      };
    }

    let orderNo: number;
    try {
      orderNo = extractChapterOrder(chapter, index + 1);
    } catch (error) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: `chapters[${index}].${error instanceof Error ? error.message : "orderNo is invalid"}`,
      };
    }

    normalizedChapters.push({
      index,
      orderNo,
      title: chapter.title.trim(),
      content: typeof content === "string" ? content : "",
      summary: typeof summary === "string" ? summary : null,
    });
  }

  const duplicatedOrderNos = [...new Set(
    normalizedChapters
      .map((chapter) => chapter.orderNo)
      .filter(
        (orderNo, index, allOrderNos) => allOrderNos.indexOf(orderNo) !== index,
      ),
  )];

  if (duplicatedOrderNos.length > 0) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "chapters.orderNo must be unique",
      details: { duplicatedOrderNos },
    };
  }

  normalizedChapters.sort((left, right) => {
    if (left.orderNo !== right.orderNo) {
      return left.orderNo - right.orderNo;
    }
    return left.index - right.index;
  });

  return {
    ok: true,
    data: {
      projectName: rawProject.name.trim(),
      projectMode: rawProject.mode,
      sourceProjectId:
        typeof rawProject.id === "string" && rawProject.id.trim().length > 0
          ? rawProject.id.trim()
          : undefined,
      chapters: normalizedChapters.map((chapter) => ({
        orderNo: chapter.orderNo,
        title: chapter.title,
        content: chapter.content,
        summary: chapter.summary,
      })),
    },
  };
}

function detectChapterImportFormat(file: File): SupportedChapterImportFormat | null {
  const normalizedName = file.name.trim().toLowerCase();
  if (normalizedName.endsWith(".docx")) {
    return "docx";
  }
  if (normalizedName.endsWith(".pdf")) {
    return "pdf";
  }
  if (normalizedName.endsWith(".epub")) {
    return "epub";
  }

  const mime = file.type.toLowerCase();
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "docx";
  }
  if (mime === "application/pdf") {
    return "pdf";
  }
  if (mime === "application/epub+zip") {
    return "epub";
  }

  return null;
}

export function validateChapterImportFormData(
  formData: FormData,
): ValidationResult<ChapterFileImportInput> {
  const files: File[] = [];

  for (const value of formData.values()) {
    if (!(value instanceof File)) {
      continue;
    }
    if (value.name.trim().length === 0) {
      continue;
    }
    files.push(value);
  }

  if (files.length === 0) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "At least one file is required",
    };
  }

  const unsupportedFiles: string[] = [];
  const normalizedFiles: ChapterFileImportInput["files"] = [];
  for (const file of files) {
    const format = detectChapterImportFormat(file);
    if (!format) {
      unsupportedFiles.push(file.name);
      continue;
    }
    normalizedFiles.push({ file, format });
  }

  if (unsupportedFiles.length > 0) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Only docx/pdf/epub files are supported",
      details: {
        unsupportedFiles,
        supportedFormats: SUPPORTED_CHAPTER_IMPORT_FORMATS,
      },
    };
  }

  return {
    ok: true,
    data: {
      files: normalizedFiles,
    },
  };
}
