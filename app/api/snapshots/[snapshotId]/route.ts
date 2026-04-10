export async function DELETE(
  _request: Request,
  context: { params: Promise<{ snapshotId: string }> },
) {
  const { snapshotId } = await context.params;

  return Response.json({
    route: 'snapshots-delete',
    action: 'delete',
    snapshotId,
  });
}
