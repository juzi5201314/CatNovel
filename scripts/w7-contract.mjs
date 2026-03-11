#!/usr/bin/env node

import assert from "node:assert/strict";

import { api, applyMigrations, baseUrl } from "./w7-test-utils.mjs";

async function expectStructuredImportFailure() {
  const response = await fetch(`${baseUrl}/api/projects/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      schemaVersion: "invalid.version",
      project: {
        id: crypto.randomUUID(),
        name: "Broken Import",
        mode: "webnovel",
      },
      chapters: [],
    }),
  });

  const payload = await response.json();
  assert.equal(response.status, 400, "import failure should return 400");
  assert.equal(payload.success, false, "import failure should be an error envelope");
  assert.equal(payload.error.details.stage, "validation", "import error should expose stage");
  assert.ok(Array.isArray(payload.error.details.issues), "import error should expose issues");
}

async function validateWorldbuildingContract(projectId) {
  const created = await api("POST", `/api/projects/${projectId}/worldbuilding`, {
    name: "  世界设定根节点  ",
    description: "最初描述",
  });

  assert.equal(created.projectId, projectId, "worldbuilding node should belong to project");
  assert.equal(created.name, "世界设定根节点", "worldbuilding create should trim name");
  assert.equal(created.parentId, null, "root worldbuilding node should have null parentId");

  const updated = await api("PATCH", `/api/projects/${projectId}/worldbuilding/${created.id}`, {
    name: "世界设定根节点（已更新）",
    description: "更新后的描述",
  });

  assert.equal(updated.id, created.id, "worldbuilding patch should keep node id");
  assert.equal(updated.name, "世界设定根节点（已更新）", "worldbuilding patch should update name");
  assert.equal(updated.description, "更新后的描述", "worldbuilding patch should update description");

  const listed = await api("GET", `/api/projects/${projectId}/worldbuilding`);
  assert.ok(Array.isArray(listed.nodes), "worldbuilding list should return nodes array");
  const persisted = listed.nodes.find((node) => node.id === created.id);
  assert.ok(persisted, "worldbuilding list should include created node");
  assert.equal(persisted.name, "世界设定根节点（已更新）", "worldbuilding list should persist updated name");
}

async function validateChatSessionContract(projectId, chapterId) {
  const created = await api("POST", "/api/ai/sessions", {
    projectId,
    chapterId,
    title: "Contract Chat Session",
    messages: [
      {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: "测试会话创建" }],
      },
    ],
    chatTerminated: false,
  });

  const listed = await api("GET", `/api/ai/sessions?projectId=${encodeURIComponent(projectId)}`);
  assert.ok(Array.isArray(listed), "chat sessions list should return array");
  assert.ok(listed.some((session) => session.id === created.id), "chat session list should include created session");

  const updated = await api("PATCH", `/api/ai/sessions/${created.id}`, {
    title: "Contract Chat Session Updated",
    messages: [
      {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: "用户消息" }],
      },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        parts: [{ type: "text", text: "助手回复" }],
      },
    ],
    chatTerminated: true,
  });

  assert.equal(updated.title, "Contract Chat Session Updated", "chat session patch should update title");
  assert.equal(updated.chatTerminated, true, "chat session patch should persist termination flag");
  assert.equal(updated.messages.length, 2, "chat session patch should persist messages");
  assert.equal(updated.messageCount, 2, "chat session patch should update messageCount");

  const detail = await api("GET", `/api/ai/sessions/${created.id}`);
  assert.equal(detail.id, created.id, "chat session detail should return same session");
  assert.equal(detail.chatTerminated, true, "chat session detail should keep termination flag");
  assert.equal(detail.messageCount, 2, "chat session detail should keep messageCount");

  const activeRun = await api("GET", `/api/ai/sessions/${created.id}/active-run`);
  assert.equal(activeRun, null, "active-run route should return null when no run exists");
}

async function main() {
  applyMigrations();

  const project = await api("POST", "/api/projects", {
    name: `Contract Project ${Date.now()}`,
    mode: "webnovel",
  });
  const chapter = await api("POST", `/api/projects/${project.id}/chapters`, {
    title: "Contract Chapter 1",
  });

  const patch = await api("PATCH", `/api/chapters/${chapter.id}`, {
    content: "第一个版本。角色 A 在雨夜相遇。",
    summary: "雨夜相遇",
  });
  assert.equal(patch.chapter.id, chapter.id, "chapter patch should return wrapped chapter");
  assert.equal(typeof patch.autoSnapshot.created, "boolean", "patch should return auto snapshot state");
  assert.ok(
    patch.timelineRecompute || typeof patch.timelineRecomputeError === "string",
    "patch should return timeline recompute result or explicit recompute error",
  );
  if (patch.timelineRecompute) {
    assert.equal(
      typeof patch.timelineRecompute.diffReport.impacted,
      "number",
      "timeline diff report should include impacted count",
    );
  }

  const manualSnapshot = await api("POST", `/api/projects/${project.id}/snapshots`, {
    reason: "contract_manual_snapshot",
  });
  assert.equal(
    typeof manualSnapshot.snapshot.id,
    "string",
    "manual snapshot should return snapshot id",
  );

  const snapshots = await api("GET", `/api/projects/${project.id}/snapshots?limit=10`);
  assert.ok(Array.isArray(snapshots.snapshots), "snapshot list should return snapshots");
  assert.ok(snapshots.snapshots.length >= 1, "snapshot list should contain at least one item");

  const newestSnapshotId = snapshots.snapshots[0].id;
  const diff = await api(
    "GET",
    `/api/projects/${project.id}/snapshots/${encodeURIComponent(newestSnapshotId)}/diff`,
  );
  assert.equal(typeof diff.diff.timeline.beforeEventCount, "number", "snapshot diff should include timeline");

  const restore = await api(
    "POST",
    `/api/projects/${project.id}/snapshots/${encodeURIComponent(newestSnapshotId)}/restore`,
    {
      reason: "contract_restore",
    },
  );
  assert.equal(
    restore.restore.restoredFromSnapshotId,
    newestSnapshotId,
    "restore should return source snapshot id",
  );

  const exported = await api("GET", `/api/projects/${project.id}/export`);
  assert.equal(exported.project.id, project.id, "export should keep current project id");
  assert.ok(Array.isArray(exported.chapters), "export should include chapters");

  const imported = await api("POST", "/api/projects/import", exported);
  assert.equal(
    imported.importedChapters,
    exported.chapters.length,
    "imported chapter count should match export",
  );
  assert.equal(
    imported.sourceProjectId,
    project.id,
    "import result should carry source project id",
  );

  await expectStructuredImportFailure();
  await validateWorldbuildingContract(project.id);
  await validateChatSessionContract(project.id, chapter.id);

  console.log("w7_contract_ok=true");
}

main().catch((error) => {
  console.error("w7_contract_ok=false");
  console.error(error);
  process.exitCode = 1;
});
