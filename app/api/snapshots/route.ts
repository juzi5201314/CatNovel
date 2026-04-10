import { createSnapshot, listSnapshots } from '../../../lib/server/snapshots';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workId = searchParams.get('workId') ?? 'work-default';

  return Response.json({
    route: 'snapshots-list',
    list: listSnapshots(workId),
    actions: ['create', 'list'],
  });
}

export async function POST(request: Request) {
  const payload = await request.json();

  return Response.json({
    route: 'snapshots-create',
    action: 'create',
    snapshot: createSnapshot({
      workId: payload.workId,
      label: payload.label,
    }),
  });
}
