import test from "node:test";
import assert from "node:assert/strict";

import { closeDatabase } from "../db/client.ts";

function setupMemoryDatabase() {
  closeDatabase();
  process.env.CATNOVEL_DB_MEMORY = "true";
  delete process.env.CATNOVEL_DATA_DIR;
  delete process.env.CATNOVEL_DB_FILE;
}

function expectDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

test("database bootstrap creates canonical tables and seed rows", async () => {
  setupMemoryDatabase();

  const [{ canonicalTables }, { getDatabase }] = await Promise.all([
    import("../db/schema.ts"),
    import("../db/client.ts"),
  ]);

  const db = getDatabase();

  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC",
    )
    .all() as Array<{ name: string }>;

  for (const table of canonicalTables) {
    assert.ok(
      tables.map((row) => row.name).includes(table),
      `missing table ${table}`,
    );
  }

  const work = db
    .prepare("SELECT id, title, locale FROM works WHERE id = 'work-default'")
    .get() as { id: string; title: string; locale: string } | undefined;

  assert.equal(work?.id, "work-default");
  assert.equal(work?.title, "CatNovel Demo");
  assert.equal(work?.locale, "zh");

  closeDatabase();
});

test("workspace data mutations support work / volume / chapter CRUD", async () => {
  setupMemoryDatabase();

  const [{ applyWorkspaceMutation, getWorkspaceCollections }] =
    await Promise.all([
      import("../lib/server/services/workspace-data-service.ts"),
    ]);

  const createdWork = applyWorkspaceMutation({
    action: "create-work",
    title: "新作品",
    locale: "zh",
    synopsis: "新的作品简介",
  });
  const workId = expectDefined(createdWork.work, "work should be created").id;

  const createdVolume = applyWorkspaceMutation({
    action: "create-volume",
    workId,
    title: "第一卷 起风时",
  });
  const volumeId = expectDefined(createdVolume.volume, "volume should be created").id;

  const createdChapter = applyWorkspaceMutation({
    action: "create-chapter",
    workId,
    volumeId,
    title: "第一章",
    bodyJson:
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"风从海面吹来，像一封迟到很久的信。"}]}]}',
  });
  const chapterId = expectDefined(createdChapter.chapter, "chapter should be created").id;

  const updatedWork = applyWorkspaceMutation({
    action: "update-work",
    workId,
    title: "新作品·修订版",
  });
  assert.equal(expectDefined(updatedWork.work, "work should update").title, "新作品·修订版");

  const updatedVolume = applyWorkspaceMutation({
    action: "update-volume",
    volumeId,
    title: "第一卷 起风时（修订）",
  });
  assert.equal(
    expectDefined(updatedVolume.volume, "volume should update").title,
    "第一卷 起风时（修订）",
  );

  const updatedChapter = applyWorkspaceMutation({
    action: "update-chapter",
    chapterId,
    title: "第一章 风从海上来",
  });
  assert.equal(
    expectDefined(updatedChapter.chapter, "chapter should update").title,
    "第一章 风从海上来",
  );

  const collections = getWorkspaceCollections();
  const targetWork = collections.works.find((work) => work.id === workId);
  const targetVolume = collections.volumes.find((volume) => volume.id === volumeId);
  const targetChapter = collections.chapters.find((chapter) => chapter.id === chapterId);

  assert.ok(targetWork);
  assert.ok(targetVolume);
  assert.ok(targetChapter);

  applyWorkspaceMutation({ action: "delete-chapter", chapterId });
  applyWorkspaceMutation({ action: "delete-volume", volumeId });
  applyWorkspaceMutation({ action: "delete-work", workId });

  const afterDelete = getWorkspaceCollections();
  assert.equal(afterDelete.works.some((work) => work.id === workId), false);

  closeDatabase();
});

test("autosave persists chapter metrics and bootstrap payload surfaces sqlite stats", async () => {
  setupMemoryDatabase();

  const [{ applyWorkspaceMutation }, { loadBootstrapPayload }] =
    await Promise.all([
      import("../lib/server/services/workspace-data-service.ts"),
      import("../lib/server/bootstrap.ts"),
    ]);

  const autosaved = applyWorkspaceMutation({
    action: "autosave-chapter",
    chapterId: "chapter-1",
    title: "第一章 雨夜之后",
    bodyJson:
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"雨停之后，霓虹落在水面上，像被撕碎的未来。"}]},{"type":"paragraph","content":[{"type":"text","text":"主角在桥边重新整理线索。"}]}]}',
  });

  const autosavedChapter = expectDefined(autosaved.chapter, "autosave should return chapter");

  assert.equal(autosavedChapter.title, "第一章 雨夜之后");
  assert.ok(autosavedChapter.wordCount > 0);
  assert.ok(autosavedChapter.characterCount > 0);
  assert.ok(autosavedChapter.readingMinutes >= 1);
  assert.ok(autosavedChapter.lastAutosavedAt);

  const payload = loadBootstrapPayload();
  const chapter = payload.workspace.chapters.find((item) => item.id === "chapter-1");

  assert.ok(chapter);
  assert.equal(chapter?.title, "第一章 雨夜之后");
  assert.ok((chapter?.characterCount ?? 0) > 0);
  assert.ok((chapter?.readingMinutes ?? 0) >= 1);
  assert.ok(payload.workspace.stats.totalWords >= chapter!.wordCount);
  assert.ok(payload.workspace.stats.totalCharacters >= chapter!.characterCount);
  assert.ok(payload.workspace.stats.lastAutosavedAt);

  closeDatabase();
});
