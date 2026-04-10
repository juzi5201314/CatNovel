import { NextResponse } from "next/server";

import { getDatabaseStatus } from "@/db/client";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    runtime: "nodejs",
    database: getDatabaseStatus(),
    checkedAt: new Date().toISOString(),
  });
}
