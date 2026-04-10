import { NextResponse } from "next/server";

import { getDatabaseStatus } from "@/db/client";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    ready: true,
    database: getDatabaseStatus(),
    checkedAt: new Date().toISOString(),
  });
}
