import { parseImportFile } from '../../../../lib/server/importers';
import type { ImportFileFormat } from '@/lib/contracts/transfer';

export async function POST(request: Request) {
  const payload = await request.json();
  const fileName = typeof payload.fileName === 'string' ? payload.fileName : ('untitled.txt' satisfies `${string}.${ImportFileFormat}`);
  const parsedDocument = parseImportFile({
    fileName,
    content: payload.content ?? '',
  });

  return Response.json({
    route: 'import-parse-file',
    parsedDocument,
  });
}
