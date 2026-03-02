import type { ImportIssue, SupportedChapterImportFormat } from "@/lib/http/import-validators";

export type ParsedChapter = {
  title: string;
  content: string;
  summary: string | null;
};

export type ParseDocumentResult =
  | {
      ok: true;
      chapters: ParsedChapter[];
      warnings: string[];
    }
  | {
      ok: false;
      issue: ImportIssue;
      status?: number;
    };

type ParseInput = {
  file: File;
  format: SupportedChapterImportFormat;
};

type ParserPayload = {
  chapters: ParsedChapter[];
  warnings: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function summarizePayloadShape(payload: unknown): unknown {
  if (isRecord(payload)) {
    return {
      keys: Object.keys(payload),
    };
  }
  return {
    type: typeof payload,
  };
}

function buildIssue(input: {
  code: string;
  message: string;
  hint: string;
  target?: string;
  details?: unknown;
}): ImportIssue {
  return {
    code: input.code,
    message: input.message,
    hint: input.hint,
    recoverable: true,
    target: input.target,
    details: input.details,
  };
}

function readWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function normalizeParserPayload(payload: unknown): ParserPayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) ? payload.data : payload;
  if (!Array.isArray(root.chapters)) {
    return null;
  }

  const chapters: ParsedChapter[] = [];
  for (let index = 0; index < root.chapters.length; index += 1) {
    const chapter = root.chapters[index];
    if (!isRecord(chapter)) {
      return null;
    }

    const title = chapter.title;
    const content = chapter.content;
    const summary = chapter.summary;

    if (typeof title !== "string" || title.trim().length === 0 || typeof content !== "string") {
      return null;
    }

    if (summary !== undefined && summary !== null && typeof summary !== "string") {
      return null;
    }

    chapters.push({
      title: title.trim(),
      content,
      summary: typeof summary === "string" ? summary : null,
    });
  }

  if (chapters.length === 0) {
    return null;
  }

  return {
    chapters,
    warnings: readWarnings(root.warnings),
  };
}

export class ParserAdapter {
  private readonly endpoint: string | null;

  constructor(endpoint = process.env.CATNOVEL_PARSER_ENDPOINT) {
    this.endpoint = typeof endpoint === "string" && endpoint.trim().length > 0 ? endpoint.trim() : null;
  }

  isConfigured(): boolean {
    return this.endpoint !== null;
  }

  getConfigurationIssue(): ImportIssue {
    return buildIssue({
      code: "PARSER_ENDPOINT_NOT_CONFIGURED",
      message: "CATNOVEL_PARSER_ENDPOINT is not configured",
      hint: "配置 CATNOVEL_PARSER_ENDPOINT 后重试导入",
    });
  }

  async parseDocument(input: ParseInput): Promise<ParseDocumentResult> {
    if (!this.endpoint) {
      return {
        ok: false,
        issue: this.getConfigurationIssue(),
      };
    }

    const body = new FormData();
    body.set("file", input.file, input.file.name);
    body.set("format", input.format);

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body,
      });
    } catch (error) {
      return {
        ok: false,
        issue: buildIssue({
          code: "PARSER_SERVICE_UNREACHABLE",
          message: "Failed to reach parser service",
          hint: "确认解析服务可访问后重试",
          target: input.file.name,
          details: {
            reason: error instanceof Error ? error.message : "unknown",
          },
        }),
      };
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      return {
        ok: false,
        status: response.status,
        issue: buildIssue({
          code: "PARSER_HTTP_ERROR",
          message: `Parser service responded with HTTP ${response.status}`,
          hint:
            response.status >= 500
              ? "解析服务暂时不可用，请稍后重试"
              : "请检查文件格式、文件内容和解析服务配置",
          target: input.file.name,
          details: {
            status: response.status,
            body: bodyText.slice(0, 2000),
          },
        }),
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {
        ok: false,
        issue: buildIssue({
          code: "PARSER_INVALID_JSON",
          message: "Parser service returned invalid JSON",
          hint: "请检查解析服务输出格式（必须为 JSON）",
          target: input.file.name,
        }),
      };
    }

    // 只接受明确的章节结构，避免“假成功”污染数据。
    const normalized = normalizeParserPayload(payload);
    if (!normalized) {
      return {
        ok: false,
        issue: buildIssue({
          code: "PARSER_INVALID_PAYLOAD",
          message: "Parser response must contain non-empty chapters[]",
          hint: "请让解析服务返回 chapters 数组且每章包含 title/content",
          target: input.file.name,
          details: summarizePayloadShape(payload),
        }),
      };
    }

    return {
      ok: true,
      chapters: normalized.chapters,
      warnings: normalized.warnings,
    };
  }
}
