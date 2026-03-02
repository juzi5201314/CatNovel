#!/usr/bin/env node

import assert from "node:assert/strict";

import { api, applyMigrations, baseUrl, poll, readSseEvents } from "./w7-test-utils.mjs";

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

async function validateContextEngine(projectId, chapterId) {
  const response = await fetch(`${baseUrl}/api/ai/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectId,
      chapterId,
      messages: [{ role: "user", content: "请给我一条剧情推进建议" }],
      retrieval: { topK: 4, enableGraph: "off" },
      override: { apiFormat: "chat_completions", modelId: "smoke-model" },
    }),
  });

  assert.equal(response.status, 200, "chat route should return 200");
  assert.match(
    response.headers.get("content-type") ?? "",
    /text\/event-stream/,
    "chat route should be SSE",
  );

  const events = await readSseEvents(response, {
    stopEvent: "done",
    timeoutMs: 10000,
  });
  const names = events.map((item) => item.event);
  assert.ok(names.includes("tool_call"), "chat stream should include tool_call");
  assert.ok(names.includes("context_used"), "chat stream should include context_used");
  assert.ok(names.includes("token"), "chat stream should include token");
  assert.ok(names.includes("done"), "chat stream should include done");

  const tokenText = events
    .filter((item) => item.event === "token")
    .map((item) => item.data?.text ?? "")
    .join("");
  assert.ok(tokenText.length > 0, "chat stream token text should not be empty");
}

async function validateRag(projectId) {
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
      timeoutMs: 20000,
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
}

async function validateTimeline(projectId, chapterId) {
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
    entityId: entity.entityId,
    extractedEvents: extract.extractedEvents,
    extractedEventId: extract.events[0]?.eventId ?? null,
  };
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
  const sseEvents = await readSseEvents(sseResponse, { maxEvents: 1, timeoutMs: 7000 });
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

  await validateContextEngine(project.id, chapter1.id);
  await validateRag(project.id);
  const timeline = await validateTimeline(project.id, chapter1.id);
  const approval = await validateApprovalsAndSse(
    project.id,
    chapter1.id,
    timeline.entityId,
    timeline.extractedEventId,
  );

  console.log("w7_core_smoke_ok=true");
  console.log(`project_id=${project.id}`);
  console.log(`timeline_extracted_events=${timeline.extractedEvents}`);
  console.log(`approval_executed_id=${approval.approvedId}`);
  console.log(`approval_rejected_id=${approval.rejectedId}`);
}

main().catch((error) => {
  console.error("w7_core_smoke_ok=false");
  console.error(error);
  process.exitCode = 1;
});
