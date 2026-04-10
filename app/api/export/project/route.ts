import { buildProjectExport } from "../../../../lib/server/exporters";
import { exportProjectArchive } from "../../../../lib/server/project-transfer";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "json") as
    | "txt"
    | "md"
    | "docx"
    | "epub"
    | "pdf"
    | "json";
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
