import { buildProjectExport } from '../../../../lib/server/exporters';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get('format') ?? 'json') as
    | 'txt'
    | 'md'
    | 'docx'
    | 'epub'
    | 'pdf'
    | 'json';

  return Response.json({
    route: 'export-project',
    exportPayload: buildProjectExport(format),
  });
}
