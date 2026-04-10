import { buildChapterBatchExport } from '../../../../lib/server/exporters';

export async function POST(request: Request) {
  const payload = await request.json();
  const format = payload.format ?? 'txt';

  return Response.json({
    route: 'export-chapters',
    exportPayload: buildChapterBatchExport(format, payload.chapters ?? []),
  });
}
