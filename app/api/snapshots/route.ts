import { createSnapshot, listSnapshots } from "../../../lib/server/snapshots";

export async function GET() {
  return Response.json({
    route: "snapshots-list",
    list: listSnapshots(),
    actions: ["create", "list"],
  });
}

export async function POST(request: Request) {
  const payload = await request.json();

  return Response.json({
    route: "snapshots-create",
    action: "create",
    snapshot: createSnapshot({
      workId: payload.workId,
      label: payload.label,
    }),
  });
}
