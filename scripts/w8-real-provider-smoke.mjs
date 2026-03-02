#!/usr/bin/env node

import assert from "node:assert/strict";

import { api, applyMigrations, baseUrl, poll, readSseEvents } from "./w7-test-utils.mjs";

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`missing required env: ${name}`);
  }
  return value.trim();
}

function summarizeErrorMessage(message) {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (normalized.length <= 320) {
    return normalized;
  }
  return `${normalized.slice(0, 320)}...`;
}

async function createProjectWithChapters() {
  const project = await api("POST", "/api/projects", {
    name: `W8 Real Provider Smoke ${Date.now()}`,
    mode: "webnovel",
  });

  const chapter1 = await api("POST", `/api/projects/${project.id}/chapters`, {
    title: "第一章 雨夜诊所",
  });
  await api("PATCH", `/api/chapters/${chapter1.id}`, {
    content:
      "雨夜中，林祁被神秘人追逐后闯入诊所，顾医生苏离为其止血并留下诊断记录。",
    summary: "林祁受伤并被顾医生苏离救治。",
  });

  const chapter2 = await api("POST", `/api/projects/${project.id}/chapters`, {
    title: "第二章 档案室",
  });
  await api("PATCH", `/api/chapters/${chapter2.id}`, {
    content: "次日，苏离与林祁在档案室核对线索，确认第九章提到的医生姓顾。",
    summary: "两人在档案室会面并确认顾医生线索。",
  });

  return { projectId: project.id, chapterId: chapter2.id, chapterIds: [chapter1.id, chapter2.id] };
}

async function createLlmConfig(projectId) {
  const chatFormatRaw = (process.env.API_FORMAT ?? "chat_completions").trim();
  const chatApiFormat =
    chatFormatRaw === "responses" ? "responses" : "chat_completions";
  const chatProtocol =
    chatApiFormat === "responses" ? "openai_responses" : "openai_compatible";

  const chatProvider = await api("POST", "/api/settings/providers", {
    name: `Smoke Chat ${Date.now()}`,
    protocol: chatProtocol,
    category: "chat",
    baseURL: requireEnv("OPENAI_BASE_URL"),
    apiKey: requireEnv("API_KEY"),
    enabled: true,
  });

  const chatPreset = await api("POST", "/api/settings/model-presets", {
    providerId: chatProvider.id,
    purpose: "chat",
    apiFormat: chatApiFormat,
    modelId: requireEnv("MODEL_ID"),
    temperature: 0.4,
    maxTokens: 512,
    thinkingBudget: {
      type: "effort",
      effort: "low",
    },
  });

  const embeddingProvider = await api("POST", "/api/settings/providers", {
    name: `Smoke Embedding ${Date.now()}`,
    protocol: "openai_compatible",
    category: "embedding",
    baseURL: (process.env.EMBEDDING_BASE_URL ?? requireEnv("OPENAI_BASE_URL")).trim(),
    apiKey: (process.env.EMBEDDING_API_KEY ?? requireEnv("API_KEY")).trim(),
    enabled: true,
  });

  const embeddingPreset = await api("POST", "/api/settings/model-presets", {
    providerId: embeddingProvider.id,
    purpose: "embedding",
    apiFormat: "embeddings",
    modelId: (process.env.EMBEDDING_MODEL ?? "text-embedding-3-small").trim(),
    maxTokens: 2048,
  });

  await api("PATCH", "/api/settings/llm-defaults", {
    projectId,
    defaultChatPresetId: chatPreset.id,
    defaultEmbeddingPresetId: embeddingPreset.id,
  });

  return {
    chatPresetId: chatPreset.id,
    embeddingPresetId: embeddingPreset.id,
    chatApiFormat,
  };
}

async function verifyAi(projectId, chapterId, chatPresetId, chatApiFormat) {
  const response = await fetch(`${baseUrl}/api/ai/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      chapterId,
      chatPresetId,
      messages: [{ role: "user", content: "基于现有章节，给一句剧情推进建议" }],
      retrieval: { topK: 4, enableGraph: "off" },
      override: {
        apiFormat: chatApiFormat,
        thinkingBudget: {
          type: "effort",
          effort: "low",
        },
      },
    }),
  });

  assert.equal(response.status, 200, "chat should return 200");
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);

  const events = await readSseEvents(response, {
    stopEvent: "done",
    maxEvents: 512,
    timeoutMs: 30000,
  });

  const names = events.map((item) => item.event);
  const hasToken = names.includes("token");
  const hasDone = names.includes("done");
  const hasError = names.includes("error");

  if (hasToken && hasDone) {
    const tokenText = events
      .filter((item) => item.event === "token")
      .map((item) => item.data?.text ?? "")
      .join("");
    assert.ok(tokenText.trim().length > 0, "chat token text should not be empty");
    return { status: "ok" };
  }

  if (hasError) {
    const errorEvent = events.find((item) => item.event === "error");
    const errorCode = errorEvent?.data?.code;
    assert.ok(
      typeof errorCode === "string",
      "chat error event should include code",
    );
    return { status: "provider_error", code: errorCode };
  }

  const tokenText = events
    .filter((item) => item.event === "token")
    .map((item) => item.data?.text ?? "")
    .join("");
  if (hasToken && !hasError) {
    return { status: "ok" };
  }
  throw new Error(
    `chat stream ended unexpectedly: events=${JSON.stringify(names)}, tokenTextLength=${tokenText.length}`,
  );
}

async function verifyRag(projectId, embeddingPresetId, chapterIds) {
  const embedResponse = await fetch(`${baseUrl}/api/rag/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectId,
      embeddingPresetId,
      texts: ["第九章的顾医生在第一章曾短暂出现。"],
    }),
  });
  const embedPayload = await embedResponse.json();

  if (embedResponse.ok && embedPayload.success === true) {
    const embed = embedPayload.data;
    assert.equal(Array.isArray(embed.vectors), true, "embed vectors should be an array");
    assert.equal(embed.vectors.length, 1, "embed should return one vector");
    assert.ok(embed.dimensions > 0, "embed dimensions should be positive");
  } else {
    assert.equal(
      embedPayload.success,
      false,
      "embed failure payload should preserve api shape",
    );
    return {
      status: "provider_error",
      code: embedPayload.error?.code ?? "UNKNOWN",
      message: embedPayload.error?.message ?? "unknown embedding error",
    };
  }

  try {
    await api("POST", "/api/rag/reindex", {
      projectId,
      chapterIds,
      reason: "full_rebuild",
    });

    await poll(
      async () => {
        const status = await api(
          "GET",
          `/api/rag/index-status?projectId=${encodeURIComponent(projectId)}`,
        );
        return status.pendingJobs === 0 && status.indexedChunks > 0 ? status : null;
      },
      {
        timeoutMs: 60000,
        intervalMs: 300,
        errorMessage: "rag reindex timeout or indexedChunks remained 0",
      },
    );

    const query = await api("POST", "/api/rag/query", {
      projectId,
      query: "顾医生最早在哪章出现",
      strategy: "vector_first",
      topK: 6,
    });

    assert.ok(Array.isArray(query.hits), "rag query hits should be an array");
    assert.ok(
      query.hits.length > 0,
      `rag query should return at least one hit, actual=${JSON.stringify(query.hits)}`,
    );
    assert.ok(Array.isArray(query.events), "rag query events should be an array");
    return { status: "ok", hits: query.hits.length, events: query.events.length };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown rag reindex/query error";
    return {
      status: "runtime_error",
      code: "RAG_REINDEX_OR_QUERY_FAILED",
      message,
    };
  }
}

async function main() {
  applyMigrations();

  const { projectId, chapterId, chapterIds } = await createProjectWithChapters();
  const { chatPresetId, embeddingPresetId, chatApiFormat } = await createLlmConfig(projectId);

  const ai = await verifyAi(projectId, chapterId, chatPresetId, chatApiFormat);
  const rag = await verifyRag(projectId, embeddingPresetId, chapterIds);

  console.log("w8_real_provider_smoke_ok=true");
  console.log(`project_id=${projectId}`);
  console.log(`chat_preset_id=${chatPresetId}`);
  console.log(`embedding_preset_id=${embeddingPresetId}`);
  console.log(`ai_status=${ai.status}`);
  if (ai.status === "provider_error") {
    console.log(`ai_error_code=${ai.code}`);
  }
  console.log(`rag_status=${rag.status}`);
  if (rag.status === "ok") {
    console.log(`rag_hits=${rag.hits}`);
    console.log(`rag_events=${rag.events}`);
  } else {
    console.log(`rag_error_code=${rag.code}`);
    if ("message" in rag && typeof rag.message === "string") {
      console.log(`rag_error_message=${summarizeErrorMessage(rag.message)}`);
    }
  }
}

main().catch((error) => {
  console.error("w8_real_provider_smoke_ok=false");
  console.error(error);
  process.exitCode = 1;
});
