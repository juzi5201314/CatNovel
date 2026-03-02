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

  console.log("w7_contract_ok=true");
}

main().catch((error) => {
  console.error("w7_contract_ok=false");
  console.error(error);
  process.exitCode = 1;
});
