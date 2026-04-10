export async function GET() {
  return Response.json({
    route: 'snapshots-list',
    list: [],
    actions: ['create', 'list'],
  });
}

export async function POST(request: Request) {
  const payload = await request.json();

  return Response.json({
    route: 'snapshots-create',
    action: 'create',
    snapshot: {
      id: payload.id ?? 'snapshot-1',
      label: payload.label ?? 'Initial snapshot',
    },
  });
}
