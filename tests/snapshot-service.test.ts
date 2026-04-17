import assert from "node:assert/strict";
import test from "node:test";

import { closeDatabase, getDatabase } from "../db/client.ts";
import {
  createSnapshot,
  deleteSnapshot,
  listSnapshots,
  restoreSnapshot,
} from "../lib/server/snapshots.ts";

function setupMemoryDatabase() {
  closeDatabase();
  process.env.CATNOVEL_DB_MEMORY = "true";
  delete process.env.CATNOVEL_DATA_DIR;
  delete process.env.CATNOVEL_DB_FILE;
}

test("snapshot service creates, restores, lists, and deletes database-backed snapshots", () => {
  setupMemoryDatabase();

  const db = getDatabase();
  const originalChapter = db
    .prepare("SELECT title FROM chapters WHERE id = 'chapter-1'")
    .get() as { title: string };
  assert.equal(originalChapter.title, "第一章 雨夜开篇");

  const created = createSnapshot({ label: "Before destructive edit" });
  assert.equal(created.label, "Before destructive edit");

  const listedBeforeDelete = listSnapshots();
  assert.equal(listedBeforeDelete.length, 1);
  assert.equal(listedBeforeDelete[0]?.id, created.id);

  db.prepare("UPDATE chapters SET title = ? WHERE id = 'chapter-1'").run("被破坏的标题");

  const mutatedChapter = db
    .prepare("SELECT title FROM chapters WHERE id = 'chapter-1'")
    .get() as { title: string };
  assert.equal(mutatedChapter.title, "被破坏的标题");

  const restored = restoreSnapshot(created.id);
  assert.equal(restored.snapshotId, created.id);

  const restoredChapter = db
    .prepare("SELECT title FROM chapters WHERE id = 'chapter-1'")
    .get() as { title: string };
  assert.equal(restoredChapter.title, "第一章 雨夜开篇");

  const deleted = deleteSnapshot(created.id);
  assert.equal(deleted.snapshotId, created.id);
  assert.equal(listSnapshots().length, 0);

  closeDatabase();
});
