import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createDatabaseBackup,
  exportProjectArchive,
  importProjectArchive,
  recoverDatabaseFromBackup,
  restoreDatabaseBackup,
  runDatabaseIntegrityCheck,
} from "../lib/server/project-transfer.ts";
import { closeDatabase, getDatabase, getDatabaseStatus } from "../db/client.ts";
import { setupMemoryDatabase } from "./helpers/db-test-utils.ts";

test("project archive export/import round-trips canonical rows", () => {
  setupMemoryDatabase();

  const archive = exportProjectArchive();
  assert.equal(archive.format, "catnovel-project-json");
  assert.equal(archive.version, 1);
  assert.ok((archive.tables.works?.length ?? 0) > 0);
  assert.ok((archive.tables.chapters?.length ?? 0) > 0);

  const db = getDatabase();
  db.prepare("DELETE FROM chapters").run();
  db.prepare("DELETE FROM works").run();

  const imported = importProjectArchive(archive);
  assert.ok((imported.tableCounts.works ?? 0) > 0);
  assert.ok((imported.tableCounts.chapters ?? 0) > 0);

  const workCount = db.prepare("SELECT COUNT(*) AS count FROM works").get() as { count: number };
  const chapterCount = db.prepare("SELECT COUNT(*) AS count FROM chapters").get() as {
    count: number;
  };

  assert.ok(workCount.count > 0);
  assert.ok(chapterCount.count > 0);

  closeDatabase();
});

test("backup / restore / corruption recovery scripts have working database primitives", () => {
  // 此测试需要文件系统来测试备份/恢复功能
  const dataDir = mkdtempSync(join(tmpdir(), "catnovel-backup-"));
  const backupDir = mkdtempSync(join(tmpdir(), "catnovel-backups-"));
  closeDatabase();
  delete process.env.CATNOVEL_DB_MEMORY;
  process.env.CATNOVEL_DATA_DIR = dataDir;

  const backup = createDatabaseBackup({ outputRoot: backupDir, label: "rehearsal" });
  assert.equal(backup.manifest.integrity, "ok");
  assert.ok(existsSync(backup.backupFile));

  const dbFile = getDatabaseStatus().file;
  closeDatabase();
  writeFileSync(dbFile, "corrupted-db", "utf8");

  const integrityBefore = runDatabaseIntegrityCheck(dbFile);
  assert.equal(integrityBefore.ok, false);

  const recovered = recoverDatabaseFromBackup(backup.backupDirectory);
  assert.equal(recovered.action, "restore-from-backup");

  const integrityAfter = runDatabaseIntegrityCheck(dbFile);
  assert.equal(integrityAfter.ok, true);

  const restored = restoreDatabaseBackup(backup.backupDirectory);
  assert.equal(restored.integrity.ok, true);

  const db = getDatabase();
  const work = db.prepare("SELECT id FROM works WHERE id = 'work-default'").get() as
    | { id: string }
    | undefined;
  assert.equal(work?.id, "work-default");

  const manifest = JSON.parse(
    readFileSync(join(backup.backupDirectory, "manifest.json"), "utf8"),
  ) as { format: string; version: number };
  assert.equal(manifest.format, "catnovel-backup");
  assert.equal(manifest.version, 1);

  closeDatabase();
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(backupDir, { recursive: true, force: true });
});
