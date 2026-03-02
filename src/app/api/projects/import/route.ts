import { fail, ok } from "@/lib/http/api-response";
import {
  createImportErrorReport,
  validateProjectJsonImportPayload,
  type ImportIssue,
} from "@/lib/http/import-validators";
import { ProjectsRepository } from "@/repositories/projects-repository";

const projectsRepository = new ProjectsRepository();

function importFailure(input: {
  code: string;
  message: string;
  status: number;
  hint: string;
  stage: "validation" | "persistence";
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

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return importFailure({
      code: "INVALID_JSON",
      message: "Request body must be valid JSON",
      status: 400,
      stage: "validation",
      hint: "请传入合法的 JSON",
      issues: [
        {
          code: "INVALID_JSON",
          message: "Failed to parse request body",
          recoverable: true,
          hint: "修正 JSON 语法后重试",
        },
      ],
    });
  }

  const validation = validateProjectJsonImportPayload(payload);
  if (!validation.ok) {
    return importFailure({
      code: validation.code,
      message: validation.message,
      status: 400,
      stage: "validation",
      hint: "请修正导入 JSON 后重试",
      issues: [
        {
          code: validation.code,
          message: validation.message,
          recoverable: true,
          hint: "确保 schemaVersion/project/chapters 字段完整且格式正确",
          details: validation.details,
        },
      ],
    });
  }

  try {
    const imported = projectsRepository.importProjectBundle({
      project: {
        id: crypto.randomUUID(),
        name: validation.data.projectName,
        mode: validation.data.projectMode,
      },
      chapters: validation.data.chapters.map((chapter) => ({
        orderNo: chapter.orderNo,
        title: chapter.title,
        content: chapter.content,
        summary: chapter.summary,
      })),
    });

    return ok(
      {
        project: imported.project,
        importedChapters: imported.chapters.length,
        sourceProjectId: validation.data.sourceProjectId ?? null,
      },
      201,
    );
  } catch (error) {
    return importFailure({
      code: "PROJECT_IMPORT_FAILED",
      message: "Failed to persist imported project",
      status: 500,
      stage: "persistence",
      hint: "请稍后重试，若持续失败请检查数据库与服务日志",
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
