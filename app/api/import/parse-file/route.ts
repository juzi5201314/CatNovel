import { parseImportFile } from '../../../../lib/server/importers';

export async function POST(request: Request) {
  const payload = await request.json();
  const parsedDocument = parseImportFile({
    fileName: payload.fileName ?? 'untitled.txt',
    content: payload.content ?? '',
  });

  return Response.json({
    route: 'import-parse-file',
    parsedDocument,
  });
}
