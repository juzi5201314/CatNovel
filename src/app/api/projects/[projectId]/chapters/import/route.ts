import { fail, ok } from "@/lib/http/api-response";
import { ParserAdapter, type ParsedChapter } from "@/core/importers/parser-adapter";
import {
  createImportErrorReport,
  validateChapterImportFormData,
  type ImportIssue,
} from "@/lib/http/import-validators";
import { ChaptersRepository, type CreateChapterInput } from "@/repositories/chapters-repository";
import { ProjectsRepository } from "@/repositories/projects-repository";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

const projectsRepository = new ProjectsRepository();
const chaptersRepository = new ChaptersRepository();
const parserAdapter = new ParserAdapter();

function importFailure(input: {
  code: string;
  message: string;
  status: number;
  hint: string;
  stage: "validation" | "configuration" | "parser" | "persistence";
  issues: ImportIssue[];
  recoverable?: boolean;
}) {
  return fail(
    input.code,
    input.message,
    input.status,
    createImportErrorReport({
      stage: input.stage,
      hint: input.hint,
      issues: input.issues,
      recoverable: input.recoverable,
    }),
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  if (!projectId) {
    return importFailure({
      code: "INVALID_PARAM",
      message: "projectId is required",
      status: 400,
      stage: "validation",
      hint: "请提供有效的 projectId",
      issues: [
        {
          code: "INVALID_PARAM",
          message: "projectId is required",
          recoverable: true,
          hint: "使用有效的项目 ID 重试",
        },
      ],
    });
  }

  const project = projectsRepository.findById(projectId);
  if (!project) {
    return fail("NOT_FOUND", "Project not found", 404);
  }

  if (!parserAdapter.isConfigured()) {
    return importFailure({
      code: "PARSER_ENDPOINT_NOT_CONFIGURED",
      message: "Parser service is not configured",
      status: 503,
      stage: "configuration",
      hint: "配置 CATNOVEL_PARSER_ENDPOINT 后重试导入",
      issues: [parserAdapter.getConfigurationIssue()],
    });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return importFailure({
      code: "INVALID_MULTIPART",
      message: "Request must be multipart/form-data",
      status: 400,
      stage: "validation",
      hint: "请使用 multipart/form-data 上传 docx/pdf/epub 文件",
      issues: [
        {
          code: "INVALID_MULTIPART",
          message: "Unable to read form-data payload",
          recoverable: true,
          hint: "检查 Content-Type 与上传体格式后重试",
        },
      ],
    });
  }

  const validation = validateChapterImportFormData(formData);
  if (!validation.ok) {
    return importFailure({
      code: validation.code,
      message: validation.message,
      status: 400,
      stage: "validation",
      hint: "请修正上传文件后重试",
      issues: [
        {
          code: validation.code,
          message: validation.message,
          recoverable: true,
          hint: "仅支持 docx/pdf/epub，且至少上传 1 个文件",
          details: validation.details,
        },
      ],
    });
  }

  try {
    const parseResults = await Promise.all(
      validation.data.files.map(async (item, index) => ({
        index,
        fileName: item.file.name,
        result: await parserAdapter.parseDocument({
          file: item.file,
          format: item.format,
        }),
      })),
    );

    const parseIssues: ImportIssue[] = [];
    const parsedFiles: Array<{
      index: number;
      fileName: string;
      chapters: ParsedChapter[];
      warnings: string[];
    }> = [];

    for (const parsed of parseResults) {
      if (!parsed.result.ok) {
        parseIssues.push(parsed.result.issue);
        continue;
      }
      parsedFiles.push({
        index: parsed.index,
        fileName: parsed.fileName,
        chapters: parsed.result.chapters,
        warnings: parsed.result.warnings,
      });
    }

    if (parseIssues.length > 0) {
      return importFailure({
        code: "CHAPTER_PARSE_FAILED",
        message: "One or more files failed to parse",
        status: 422,
        stage: "parser",
        hint: "请根据错误修正文件或解析服务后重试",
        issues: parseIssues,
      });
    }

    parsedFiles.sort((left, right) => left.index - right.index);
    const nextOrderNo = chaptersRepository.getNextOrderNo(projectId);
    const chapterInputs: CreateChapterInput[] = [];
    const parserWarnings: Array<{ fileName: string; warning: string }> = [];

    let orderNo = nextOrderNo;
    for (const parsedFile of parsedFiles) {
      for (const warning of parsedFile.warnings) {
        parserWarnings.push({
          fileName: parsedFile.fileName,
          warning,
        });
      }

      for (const chapter of parsedFile.chapters) {
        chapterInputs.push({
          id: crypto.randomUUID(),
          projectId,
          orderNo,
          title: chapter.title,
          content: chapter.content,
          summary: chapter.summary,
        });
        orderNo += 1;
      }
    }

    const created = chaptersRepository.createMany(chapterInputs);

    return ok(
      {
        projectId,
        importedFiles: parsedFiles.length,
        importedChapters: created.length,
        parserWarnings,
        chapters: created,
      },
      201,
    );
  } catch (error) {
    return importFailure({
      code: "CHAPTER_IMPORT_FAILED",
      message: "Failed to persist imported chapters",
      status: 500,
      stage: "persistence",
      hint: "请稍后重试，若持续失败请检查数据库与解析服务状态",
      issues: [
        {
          code: "DATABASE_WRITE_FAILED",
          message: error instanceof Error ? error.message : "Unknown persistence error",
          recoverable: true,
          hint: "排查数据库可写性后重试",
        },
      ],
    });
  }
}
