import { buildProjectExport } from "../../../../lib/server/exporters";
import { exportProjectArchive } from "../../../../lib/server/project-transfer";
import { projectExportFormats, type ProjectExportFormat } from '@/lib/contracts/transfer';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedFormat = searchParams.get('format');
  const format: ProjectExportFormat = requestedFormat && projectExportFormats.includes(requestedFormat as ProjectExportFormat)
    ? requestedFormat as ProjectExportFormat
    : 'json';
  const exportPayload =
    format === "json"
      ? {
          format,
          fileName: "catnovel-project.json",
          content: JSON.stringify(exportProjectArchive(), null, 2),
        }
      : buildProjectExport(format);

  return Response.json({
    route: "export-project",
    exportPayload,
  });
}
