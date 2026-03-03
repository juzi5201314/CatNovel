import assert from "node:assert/strict";

async function readUIChunks(response) {
  assert.equal(response.status, 200);
  assert.ok(response.body);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const dataLines = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        }
      }

      const rawData = dataLines.join("\n").trim();
      if (rawData.length > 0) {
        const chunk = JSON.parse(rawData);
        chunks.push(chunk);
        if (chunk.type === "finish") {
          await reader.cancel();
          return chunks;
        }
      }

      boundary = buffer.indexOf("\n\n");
    }
  }

  return chunks;
}

async function run() {
  const routeModule = await import("../src/app/api/ai/chat/route.ts");
  const POST = routeModule.POST;
  assert.equal(typeof POST, "function", "POST route handler 应该可用");

  const request = new Request("http://localhost/api/ai/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      projectId: "project_verify_chat_route",
      messages: [{ role: "user", content: "列出可用tools" }],
    }),
  });

  const response = await POST(request);
  const chunks = await readUIChunks(response);
  const text = chunks
    .filter((chunk) => chunk.type === "text-delta")
    .map((chunk) => chunk.delta ?? "")
    .join("");

  assert.match(text, /当前可用工具共\s*\d+\s*个/, "应包含工具数量");
  assert.ok(chunks.some((chunk) => chunk.type === "finish"), "应包含 finish 事件");

  console.log("verify_chat_route_list_tools_ok=true");
  console.log(`chunk_count=${chunks.length}`);
  console.log(`text_preview=${text.slice(0, 160)}`);
}

run().catch((error) => {
  console.error("verify_chat_route_list_tools_ok=false");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
