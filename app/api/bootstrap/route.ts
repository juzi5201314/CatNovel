import { NextResponse } from "next/server";

import { loadBootstrapPayload } from "@/lib/server/bootstrap";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(loadBootstrapPayload());
}
