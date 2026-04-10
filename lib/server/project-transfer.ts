import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SQLInputValue } from "node:sqlite";

import { closeDatabase, getDatabase, getDatabaseStatus } from "../../db/client.ts";
import { canonicalTables } from "../../db/schema.ts";

export interface ProjectArchive {
  format: "catnovel-project-json";
  version: 1;
  exportedAt: string;
  tables: Partial<Record<(typeof canonicalTables)[number], Record<string, unknown>[]>>;
}

export interface BackupManifest {
  format: "catnovel-backup";
  version: 1;
  label: string;
  createdAt: string;
  databaseFileName: string;
  integrity: "ok" | "failed";
}

const importDeleteOrder = [...canonicalTables].reverse();
const importInsertOrder = [...canonicalTables];

function resolveActiveDatabaseFile() {
  const explicitFile = process.env.CATNOVEL_DB_FILE;
  if (explicitFile) {
    mkdirSync(dirname(explicitFile), { recursive: true });
    return explicitFile;
  }

  const dataDir = process.env.CATNOVEL_DATA_DIR ?? join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });
  return join(dataDir, "app.db");
}

function assertKnownTable(table: string): table is (typeof canonicalTables)[number] {
  return (canonicalTables as readonly string[]).includes(table);
}

function listTableRows(table: (typeof canonicalTables)[number]) {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
}

function normalizeArchive(input: unknown): ProjectArchive {
  if (typeof input !== "object" || input === null) {
    throw new Error("Project archive must be an object.");
  }

  const candidate = input as Partial<ProjectArchive>;

  if (candidate.format !== "catnovel-project-json") {
    throw new Error("Unsupported project archive format.");
  }

  if (candidate.version !== 1) {
    throw new Error("Unsupported project archive version.");
  }

  return {
    format: "catnovel-project-json",
    version: 1,
    exportedAt:
      typeof candidate.exportedAt === "string"
        ? candidate.exportedAt
        : new Date().toISOString(),
    tables:
      typeof candidate.tables === "object" && candidate.tables !== null
        ? candidate.tables
        : {},
  };
}

export function exportProjectArchive(): ProjectArchive {
  const tables = Object.fromEntries(
    canonicalTables.map((table) => [table, listTableRows(table)]),
  ) as ProjectArchive["tables"];

  return {
    format: "catnovel-project-json",
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

export function serializeProjectArchive() {
  return JSON.stringify(exportProjectArchive(), null, 2);
}

export function importProjectArchive(input: unknown) {
  const archive = normalizeArchive(input);
  const db = getDatabase();

  db.exec("BEGIN IMMEDIATE");

  try {
    for (const table of importDeleteOrder) {
      if (!assertKnownTable(table)) {
        continue;
      }
      db.prepare(`DELETE FROM ${table}`).run();
    }

    for (const table of importInsertOrder) {
      if (!assertKnownTable(table)) {
        continue;
      }

      const rows = archive.tables[table];
      if (!Array.isArray(rows) || rows.length === 0) {
        continue;
      }

      for (const row of rows) {
        if (typeof row !== "object" || row === null) {
          continue;
        }

        const entries = Object.entries(row);
        if (entries.length === 0) {
          continue;
        }

        const columns = entries.map(([column]) => column);
        const placeholders = columns.map(() => "?").join(", ");
        const statement = db.prepare(
          `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
        );

        const values = entries.map(([, value]) => value as SQLInputValue);
        statement.run(...values);
      }
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    importedAt: new Date().toISOString(),
    tableCounts: Object.fromEntries(
      canonicalTables.map((table) => [table, listTableRows(table).length]),
    ),
  };
}

function resolveBackupDirectory(targetRoot?: string, label?: string) {
  const fallbackRoot = join(process.cwd(), "data", "backups");
  const outputRoot = resolve(targetRoot ?? fallbackRoot);
  mkdirSync(outputRoot, { recursive: true });

  const safeLabel = (label ?? "manual")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDirectory = join(outputRoot, `${timestamp}-${safeLabel || "manual"}`);
  mkdirSync(backupDirectory, { recursive: true });

  return backupDirectory;
}

export function runDatabaseIntegrityCheck(targetFile?: string) {
  const databaseFile = targetFile ?? getDatabaseStatus().file;

  if (!existsSync(databaseFile)) {
    return {
      ok: false,
      result: "missing database file",
      databaseFile,
    };
  }

  let db: DatabaseSync | null = null;

  try {
    db = new DatabaseSync(databaseFile);
    const row = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
    const result = row.integrity_check;

    return {
      ok: result === "ok",
      result,
      databaseFile,
    };
  } catch (error) {
    return {
      ok: false,
      result: error instanceof Error ? error.message : String(error),
      databaseFile,
    };
  } finally {
    db?.close();
  }
}

export function createDatabaseBackup(options?: {
  outputRoot?: string;
  label?: string;
}) {
  const status = getDatabaseStatus();
  const backupDirectory = resolveBackupDirectory(options?.outputRoot, options?.label);
  const databaseFileName = "app.db";
  const backupFile = join(backupDirectory, databaseFileName);

  closeDatabase();
  copyFileSync(status.file, backupFile);

  const integrity = runDatabaseIntegrityCheck(backupFile);
  const manifest: BackupManifest = {
    format: "catnovel-backup",
    version: 1,
    label: options?.label ?? "manual",
    createdAt: new Date().toISOString(),
    databaseFileName,
    integrity: integrity.ok ? "ok" : "failed",
  };

  writeFileSync(
    join(backupDirectory, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  return {
    backupDirectory,
    backupFile,
    manifest,
    integrity,
  };
}

export function restoreDatabaseBackup(backupDirectory: string) {
  const manifestFile = join(backupDirectory, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8")) as BackupManifest;
  const sourceFile = join(backupDirectory, manifest.databaseFileName);
  const targetFile = resolveActiveDatabaseFile();

  mkdirSync(dirname(targetFile), { recursive: true });
  closeDatabase();
  copyFileSync(sourceFile, targetFile);

  const integrity = runDatabaseIntegrityCheck(targetFile);
  if (!integrity.ok) {
    throw new Error(`Restored database failed integrity check: ${integrity.result}`);
  }

  return {
    restoredAt: new Date().toISOString(),
    sourceFile,
    targetFile,
    manifest,
    integrity,
  };
}

export function recoverDatabaseFromBackup(backupDirectory: string) {
  const targetFile = resolveActiveDatabaseFile();
  const before = runDatabaseIntegrityCheck(targetFile);

  if (before.ok) {
    return {
      action: "noop",
      integrity: before,
    };
  }

  const restored = restoreDatabaseBackup(backupDirectory);

  return {
    action: "restore-from-backup",
    before,
    restored,
  };
}
