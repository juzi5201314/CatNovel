import { NextResponse } from "next/server";

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiSuccessEnvelope<T> = {
  success: true;
  data: T;
};

export type ApiErrorEnvelope = {
  success: false;
  error: ApiErrorPayload;
};

export function ok<T>(data: T, status = 200): NextResponse<ApiSuccessEnvelope<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
): NextResponse<ApiErrorEnvelope> {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, details },
    },
    { status },
  );
}

export async function parseJsonBody(
  request: Request,
): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse<ApiErrorEnvelope> }> {
  try {
    const data = await request.json();
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: fail("INVALID_JSON", "Request body must be valid JSON", 400),
    };
  }
}

export function internalError(error: unknown): NextResponse<ApiErrorEnvelope> {
  const message = error instanceof Error ? error.message : "Unknown error";
  return fail("INTERNAL_ERROR", "Unexpected server error", 500, { message });
}
