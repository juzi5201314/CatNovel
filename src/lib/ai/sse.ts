export type SseEventName = "token" | "tool_call" | "context_used" | "done" | "error";

type StreamController = ReadableStreamDefaultController<Uint8Array>;

const encoder = new TextEncoder();

function toSseFrame(event: SseEventName, payload: unknown): Uint8Array {
  const data = JSON.stringify(payload);
  return encoder.encode(`event: ${event}\ndata: ${data}\n\n`);
}

export class SseWriter {
  private closed = false;

  constructor(private readonly controller: StreamController) {}

  emit(event: SseEventName, payload: unknown): void {
    if (this.closed) {
      return;
    }
    this.controller.enqueue(toSseFrame(event, payload));
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.controller.close();
  }
}

export function createSseResponse(
  signal: AbortSignal,
  run: (writer: SseWriter, signal: AbortSignal) => Promise<void>,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const writer = new SseWriter(controller);

      const onAbort = () => {
        writer.emit("done", { finishReason: "aborted" });
        writer.close();
      };

      signal.addEventListener("abort", onAbort, { once: true });

      try {
        await run(writer, signal);
      } catch (error) {
        if (!signal.aborted) {
          writer.emit("error", {
            code: "STREAM_ERROR",
            message: error instanceof Error ? error.message : "unknown_error",
          });
          writer.emit("done", { finishReason: "error" });
        }
      } finally {
        signal.removeEventListener("abort", onAbort);
        writer.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
