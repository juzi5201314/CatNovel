import { NextResponse } from "next/server";

import { loadBootstrapPayload } from "@/lib/server/bootstrap";
import {
  applyWorkspaceMutation,
  getPersistenceSnapshot,
} from "@/lib/server/services/workspace-data-service";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(loadBootstrapPayload());
}

export async function POST(request: Request) {
  const input = (await request.json().catch(() => null)) as unknown;

  try {
    const result = applyWorkspaceMutation(input);

    return NextResponse.json({
      ok: true,
      result,
      collections: getPersistenceSnapshot(),
      bootstrap: loadBootstrapPayload(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown bootstrap mutation error",
      },
      { status: 400 },
    );
  }
}
