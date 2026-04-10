import { importProjectArchive } from "../../../../lib/server/project-transfer";

export async function POST(request: Request) {
  const payload = await request.json();

  return Response.json({
    route: "import-project",
    result: importProjectArchive(payload.archive ?? payload),
  });
}
