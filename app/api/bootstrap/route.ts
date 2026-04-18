import { NextResponse } from 'next/server';

import { loadBootstrapPayload } from '@/lib/server/bootstrap';
import {
  applyWorkspaceMutation,
  getPersistenceSnapshot,
} from '@/lib/server/services/workspace-data-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workId = searchParams.get('workId') ?? undefined;
  const sessionId = searchParams.get('sessionId') ?? undefined;

  return NextResponse.json({
    bootstrap: loadBootstrapPayload(workId),
    collections: getPersistenceSnapshot({ workId, sessionId }),
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

export async function POST(request: Request) {
  let input: Record<string, unknown>;

  try {
    input = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid JSON payload.',
      },
      { status: 400 },
    );
  }

  const workId =
    typeof input.currentWorkId === 'string' ? input.currentWorkId : undefined;
  const sessionId =
    typeof input.currentSessionId === 'string' ? input.currentSessionId : undefined;

  try {
    const result = applyWorkspaceMutation(input);

    return NextResponse.json({
      ok: true,
      result,
      collections: getPersistenceSnapshot({ workId, sessionId }),
      bootstrap: loadBootstrapPayload(workId),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : 'Unknown bootstrap mutation error',
      },
      { status: 400 },
    );
  }
}
