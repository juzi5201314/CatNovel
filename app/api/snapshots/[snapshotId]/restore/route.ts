import { restoreSnapshot } from "../../../../../lib/server/snapshots";

export async function POST(
  _request: Request,
  context: { params: Promise<{ snapshotId: string }> },
) {
  const { snapshotId } = await context.params;

  return Response.json({
    route: "snapshots-restore",
    action: "restore",
    snapshot: restoreSnapshot(snapshotId),
  });
}
