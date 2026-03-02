import { fail } from "@/lib/http/api-response";
import { ToolApprovalsRepository } from "@/repositories/tool-approvals-repository";

const approvalsRepository = new ToolApprovalsRepository();
const encoder = new TextEncoder();

function formatSseData(event: string, payload: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId) {
    return fail("INVALID_QUERY", "projectId is required", 400);
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const emitSnapshot = () => {
        if (closed) {
          return;
        }

        const rows = approvalsRepository.listByProject(projectId, "pending");
        const approvals = rows.map((row) => ({
          id: row.id,
          projectId: row.projectId,
          toolName: row.toolName,
          riskLevel: row.riskLevel,
          status: row.status,
          reason: row.reason,
          requestedAt: row.requestedAt.toISOString(),
          expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
        }));

        controller.enqueue(
          formatSseData("tool_approvals_snapshot", { projectId, approvals }),
        );
      };

      const interval = setInterval(emitSnapshot, 2000);
      emitSnapshot();

      const abortHandler = () => {
        if (closed) {
          return;
        }
        closed = true;
        clearInterval(interval);
        controller.close();
      };

      request.signal.addEventListener("abort", abortHandler);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
