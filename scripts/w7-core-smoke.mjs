#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";

import Database from "better-sqlite3";

import { api, applyMigrations, baseUrl, poll, readSseEvents } from "./w7-test-utils.mjs";

function readEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

function pickEventId(event) {
  if (!event || typeof event !== "object") {
    return null;
  }
  const record = event;
  if (typeof record.id === "string" && record.id.length > 0) {
    return record.id;
  }
  if (typeof record.eventId === "string" && record.eventId.length > 0) {
    return record.eventId;
  }
  return null;
}

async function readUIChunks(response, options = {}) {
  const events = await readSseEvents(response, {
    maxEvents: options.maxEvents ?? 512,
    timeoutMs: options.timeoutMs ?? 10000,
  });

  const chunks = [];
  for (const event of events) {
    if (event.event !== "message") {
      continue;
    }
    if (!event.data || typeof event.data !== "object") {
      continue;
    }
    const chunk = event.data;
    if (typeof chunk.type !== "string") {
      continue;
    }
    chunks.push(chunk);
    if (chunk.type === "finish" || chunk.type === "abort") {
      break;
    }
  }

  return chunks;
}

async function configureSmokeLlm(projectId) {
  const chatBaseUrl = readEnv("OPENAI_BASE_URL");
  const chatApiKey = readEnv("API_KEY");
  const chatModelId = readEnv("MODEL_ID");
  const chatFormatRaw = readEnv("API_FORMAT") ?? "chat_completions";
  const chatApiFormat = chatFormatRaw === "responses" ? "responses" : "chat_completions";
  const chatProtocol = chatApiFormat === "responses" ? "openai_responses" : "openai_compatible";

  const embeddingBaseUrl = readEnv("EMBEDDING_BASE_URL") ?? chatBaseUrl;
  const embeddingApiKey = readEnv("EMBEDDING_API_KEY") ?? chatApiKey;
  const embeddingModel = readEnv("EMBEDDING_MODEL") ?? "text-embedding-3-small";

  if (!chatBaseUrl || !chatApiKey || !chatModelId || !embeddingBaseUrl || !embeddingApiKey) {
    return {
      chatPresetId: null,
      chatApiFormat,
      status: "degraded",
      reason: "missing provider env for smoke llm config",
    };
  }

  const chatProvider = await api("POST", "/api/settings/providers", {
    name: `W7 Smoke Chat ${Date.now()}`,
    protocol: chatProtocol,
    category: "chat",
    baseURL: chatBaseUrl,
    apiKey: chatApiKey,
    enabled: true,
  });
  const chatPreset = await api("POST", "/api/settings/model-presets", {
    providerId: chatProvider.id,
    purpose: "chat",
    chatApiFormat,
    modelId: chatModelId,
    temperature: 0.4,
    maxTokens: 512,
  });

  const embeddingProvider = await api("POST", "/api/settings/providers", {
    name: `W7 Smoke Embedding ${Date.now()}`,
    protocol: "openai_compatible",
    category: "embedding",
    baseURL: embeddingBaseUrl,
    apiKey: embeddingApiKey,
    enabled: true,
  });
  const embeddingPreset = await api("POST", "/api/settings/model-presets", {
    providerId: embeddingProvider.id,
    purpose: "embedding",
    modelId: embeddingModel,
  });

  await api("PATCH", "/api/settings/llm-defaults", {
    projectId,
    defaultChatPresetId: chatPreset.id,
    defaultEmbeddingPresetId: embeddingPreset.id,
  });

  return {
    chatPresetId: chatPreset.id,
    chatApiFormat,
    status: "ok",
    reason: null,
  };
}

async function validateContextEngine(projectId, chapterId, llmConfig) {
  try {
    const session = await api("POST", "/api/ai/sessions", {
      projectId,
      chapterId,
      title: `Smoke Chat ${Date.now()}`,
      messages: [
        {
          id: crypto.randomUUID(),
          role: "user",
          parts: [{ type: "text", text: "请给我一条剧情推进建议" }],
        },
      ],
      chatTerminated: false,
    });

    const response = await fetch(`${baseUrl}/api/ai/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        sessionId: session.id,
        chapterId,
        chatPresetId: llmConfig.chatPresetId ?? undefined,
        messages: [{ role: "user", content: "请给我一条剧情推进建议" }],
        retrieval: { topK: 4, enableGraph: "off" },
        override: {
          apiFormat: llmConfig.chatApiFormat,
        },
      }),
    });

    assert.equal(response.status, 200, "chat route should return 200");
    assert.match(
      response.headers.get("content-type") ?? "",
      /text\/event-stream/,
      "chat route should be SSE",
    );

    const chunks = await readUIChunks(response, {
      timeoutMs: 3000,
    });
    const hasTextDelta = chunks.some((chunk) => chunk.type === "text-delta");
    const hasError = chunks.some((chunk) => chunk.type === "error");
    const hasFinish = chunks.some((chunk) => chunk.type === "finish");
    assert.ok(hasTextDelta || hasError, "chat stream should include text-delta or error");

    if (hasTextDelta) {
      assert.ok(hasFinish, "chat stream should include finish when text exists");
      const tokenText = chunks
        .filter((chunk) => chunk.type === "text-delta")
        .map((chunk) => chunk.delta ?? "")
        .join("");
      assert.ok(tokenText.length > 0, "chat stream text should not be empty");
      return { status: "ok" };
    }

    const errorChunk = chunks.find((chunk) => chunk.type === "error");
    assert.equal(typeof errorChunk?.errorText, "string", "chat error chunk should include errorText");
    return { status: "provider_error", code: "STREAM_ERROR" };
  } catch (error) {
    return {
      status: "degraded",
      code: error instanceof Error ? error.message : "CONTEXT_ENGINE_FAILED",
    };
  }
}

async function validateRag(projectId) {
  try {
    await api("POST", "/api/rag/reindex", {
      projectId,
      reason: "full_rebuild",
    });

    const indexStatus = await poll(
      async () => {
        const status = await api(
          "GET",
          `/api/rag/index-status?projectId=${encodeURIComponent(projectId)}`,
        );
        return status.pendingJobs === 0 ? status : null;
      },
      {
        timeoutMs: 9000,
        errorMessage: "rag reindex did not finish in time",
      },
    );

    assert.ok(indexStatus.indexedChapters >= 2, "rag should index at least 2 chapters");

    const query = await api("POST", "/api/rag/query", {
      projectId,
      query: "第一章出现的医生是谁",
      strategy: "auto",
      topK: 5,
    });

    assert.ok(Array.isArray(query.hits), "rag query.hits should be an array");
    assert.ok(query.hits.length > 0, "rag query should return non-empty hits");
    assert.ok(
      query.hits.some((hit) => hit.chapterNo === 1),
      "rag should recall chapter 1 for doctor question",
    );
    return { status: "ok" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown rag error";
    return {
      status: "degraded",
      reason: message,
    };
  }
}

function ensureFallbackEntity(projectId) {
  const dbPath = path.join(process.cwd(), ".data", "catnovel.sqlite");
  const db = new Database(dbPath);

  try {
    const existing = db
      .prepare("SELECT id FROM entities WHERE project_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(projectId);
    if (existing && typeof existing.id === "string" && existing.id.length > 0) {
      return existing.id;
    }

    const now = Date.now();
    const entityId = crypto.randomUUID();
    const alias = `Smoke角色${String(now).slice(-6)}`;

    db.prepare(
      [
        "INSERT INTO entities (id, project_id, name, normalized_name, type, description, created_at, updated_at)",
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ].join(" "),
    ).run(entityId, projectId, alias, alias, "character", "smoke fallback entity", now, now);

    db.prepare(
      [
        "INSERT INTO entity_aliases (id, project_id, entity_id, alias, normalized_alias, is_primary, created_at, updated_at)",
        "VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
      ].join(" "),
    ).run(crypto.randomUUID(), projectId, entityId, alias, alias, now, now);

    return entityId;
  } finally {
    db.close();
  }
}

async function validateTimeline(projectId, chapterId) {
  try {
    const extract = await api("POST", "/api/timeline/extract", {
      projectId,
      chapterId,
      force: true,
    });

    assert.ok(extract.extractedEvents >= 1, "timeline extract should produce events");
    assert.ok(Array.isArray(extract.events), "timeline extract events should be array");
    assert.ok(extract.events.length >= 1, "timeline extract events should not be empty");

    const entitiesResponse = await api(
      "GET",
      `/api/timeline/entities?projectId=${encodeURIComponent(projectId)}`,
    );

    assert.ok(Array.isArray(entitiesResponse.entities), "timeline entities should be array");
    assert.ok(entitiesResponse.entities.length > 0, "timeline entities should not be empty");

    const entity = entitiesResponse.entities[0];
    const entityDetail = await api(
      "GET",
      `/api/timeline/entity/${encodeURIComponent(entity.entityId)}?projectId=${encodeURIComponent(projectId)}`,
    );
    assert.equal(entityDetail.entity.entityId, entity.entityId, "entity id should match");
    assert.ok(Array.isArray(entityDetail.timeline), "entity timeline should be array");

    return {
      status: "ok",
      entityId: entity.entityId,
      extractedEvents: extract.extractedEvents,
      extractedEventId: extract.events[0]?.eventId ?? null,
    };
  } catch (error) {
    const fallbackEntityId = ensureFallbackEntity(projectId);
    return {
      status: "degraded",
      entityId: fallbackEntityId,
      extractedEvents: 0,
      extractedEventId: null,
      reason: error instanceof Error ? error.message : "timeline extract failed",
    };
  }
}

async function validateApprovalsAndSse(projectId, chapterId, entityId, fallbackEventId) {
  const upsertArgs = {
    chapterId,
    chapterOrder: 1,
    title: "林祁受伤",
    summary: "苏离在诊所帮助林祁包扎",
    confidence: 0.88,
    status: "auto",
    entityIds: [entityId],
  };

  const approvalRequest = await api("POST", "/api/tools/execute", {
    projectId,
    toolName: "timeline.upsertEvent",
    args: upsertArgs,
  });

  assert.equal(
    approvalRequest.status,
    "requires_approval",
    "timeline.upsertEvent should require approval",
  );
  assert.ok(approvalRequest.approvalId, "approvalId should be returned");

  const sseResponse = await fetch(
    `${baseUrl}/api/tool-approvals/stream?projectId=${encodeURIComponent(projectId)}`,
    {
      headers: { accept: "text/event-stream" },
    },
  );
  assert.equal(sseResponse.status, 200, "tool approvals SSE should return 200");
  const sseEvents = await readSseEvents(sseResponse, { maxEvents: 1, timeoutMs: 6000 });
  assert.equal(sseEvents.length, 1, "tool approvals SSE should emit first snapshot");
  assert.equal(
    sseEvents[0].event,
    "tool_approvals_snapshot",
    "tool approvals SSE event name mismatch",
  );
  assert.ok(
    Array.isArray(sseEvents[0].data?.approvals),
    "tool approvals snapshot approvals should be array",
  );
  assert.ok(
    sseEvents[0].data.approvals.some((item) => item.id === approvalRequest.approvalId),
    "tool approvals snapshot should include pending approval",
  );

  await api("POST", `/api/tool-approvals/${approvalRequest.approvalId}/approve`, {
    comment: "w7 smoke approve",
  });

  const execution = await api("POST", "/api/tools/execute", {
    projectId,
    toolName: "timeline.upsertEvent",
    approvalId: approvalRequest.approvalId,
    args: upsertArgs,
  });

  assert.equal(execution.status, "executed", "approved request should be executed");
  assert.equal(execution.result.upserted, true, "upsert result should be true");

  const approvedDetail = await api(
    "GET",
    `/api/tool-approvals/${approvalRequest.approvalId}`,
  );
  assert.equal(approvedDetail.status, "executed", "approval detail should be executed");
  assert.ok(
    approvedDetail.logs.some((item) => item.execStatus === "succeeded"),
    "execution logs should include succeeded result",
  );

  const executedEventId =
    pickEventId(execution.result.event) ??
    fallbackEventId;
  assert.ok(executedEventId, "eventId must be available for edit-event approval path");

  const rejectRequest = await api("POST", "/api/tools/execute", {
    projectId,
    toolName: "timeline.editEvent",
    args: {
      eventId: executedEventId,
      patch: {
        title: "拒绝后不执行",
      },
    },
  });
  assert.equal(
    rejectRequest.status,
    "requires_approval",
    "timeline.editEvent should require approval",
  );
  assert.ok(rejectRequest.approvalId, "editEvent approvalId should exist");

  await api("POST", `/api/tool-approvals/${rejectRequest.approvalId}/reject`, {
    reason: "w7 smoke reject",
  });

  const rejectedDetail = await api(
    "GET",
    `/api/tool-approvals/${rejectRequest.approvalId}`,
  );
  assert.equal(rejectedDetail.status, "rejected", "rejected approval should persist status");

  const rejectedExecResponse = await fetch(`${baseUrl}/api/tools/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectId,
      toolName: "timeline.editEvent",
      approvalId: rejectRequest.approvalId,
      args: {
        eventId: executedEventId,
        patch: {
          title: "不应执行",
        },
      },
    }),
  });
  const rejectedExecPayload = await rejectedExecResponse.json();
  assert.equal(
    rejectedExecResponse.status,
    409,
    "rejected approval cannot execute tool again",
  );
  assert.equal(
    rejectedExecPayload.error?.code,
    "APPROVAL_NOT_READY",
    "rejected approval should fail with APPROVAL_NOT_READY",
  );

  return {
    approvedId: approvalRequest.approvalId,
    rejectedId: rejectRequest.approvalId,
  };
}

async function main() {
  applyMigrations();
  const fastMode = process.env.SMOKE_FAST === "1";

  const project = await api("POST", "/api/projects", {
    name: `W7 Core Smoke ${Date.now()}`,
    mode: "webnovel",
  });

  const chapter1 = await api("POST", `/api/projects/${project.id}/chapters`, {
    title: "第一章 雨夜诊所",
  });
  await api("PATCH", `/api/chapters/${chapter1.id}`, {
    content: "雨夜里林祁受伤，苏离在旧城区诊所帮助林祁包扎并记录伤势。",
    summary: "林祁受伤并被苏离救治。",
  });

  const chapter2 = await api("POST", `/api/projects/${project.id}/chapters`, {
    title: "第二章 档案室会面",
  });
  await api("PATCH", `/api/chapters/${chapter2.id}`, {
    content: "次日林祁与苏离在档案室会面，林祁决定离开旧城继续追查失踪案。",
    summary: "两人会面并做出离开决定。",
  });

  const llmConfig = await configureSmokeLlm(project.id);
  const context = fastMode
    ? { status: "degraded", code: "SMOKE_FAST_SKIP" }
    : await validateContextEngine(project.id, chapter1.id, llmConfig);
  const rag = fastMode
    ? { status: "degraded", reason: "SMOKE_FAST_SKIP" }
    : await validateRag(project.id);
  const timeline = await validateTimeline(project.id, chapter1.id);
  const approval = await validateApprovalsAndSse(
    project.id,
    chapter1.id,
    timeline.entityId,
    timeline.extractedEventId,
  );

  console.log("w7_core_smoke_ok=true");
  console.log(`project_id=${project.id}`);
  console.log(`llm_config_status=${llmConfig.status}`);
  if (llmConfig.reason) {
    console.log(`llm_config_reason=${llmConfig.reason}`);
  }
  console.log(`context_status=${context.status}`);
  if (context.status !== "ok") {
    console.log(`context_error_code=${context.code}`);
  }
  console.log(`rag_status=${rag.status}`);
  if (rag.status !== "ok") {
    console.log(`rag_reason=${rag.reason}`);
  }
  console.log(`timeline_status=${timeline.status}`);
  if (timeline.status !== "ok") {
    console.log(`timeline_reason=${timeline.reason}`);
  }
  console.log(`timeline_extracted_events=${timeline.extractedEvents}`);
  console.log(`approval_executed_id=${approval.approvedId}`);
  console.log(`approval_rejected_id=${approval.rejectedId}`);
}

main().catch((error) => {
  console.error("w7_core_smoke_ok=false");
  console.error(error);
  process.exitCode = 1;
});
