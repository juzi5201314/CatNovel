import { buildChapterBatchExport } from '../../../../lib/server/exporters';
import type { ChapterExportFormat } from '@/lib/contracts/transfer';

export async function POST(request: Request) {
  const payload = await request.json();
  const format = (payload.format ?? 'txt') as ChapterExportFormat;

  return Response.json({
    route: 'export-chapters',
    exportPayload: buildChapterBatchExport(format, payload.chapters ?? []),
  });
}
