import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("database bootstrap creates canonical tables and seed rows", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "catnovel-db-"));
  process.env.CATNOVEL_DATA_DIR = dataDir;

  const [{ canonicalTables }, { closeDatabase, getDatabase }] = await Promise.all([
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
  rmSync(dataDir, { recursive: true, force: true });
});
