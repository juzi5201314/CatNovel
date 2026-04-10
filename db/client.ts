import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { schemaMigrations, seedStatements } from "./schema.ts";

export type DatabaseStatus = {
  file: string;
  tables: number;
  bootstrappedAt: string;
};

let dbInstance: DatabaseSync | null = null;
let dbStatus: DatabaseStatus | null = null;

function resolveDatabaseFile() {
  const explicitFile = process.env.CATNOVEL_DB_FILE;
  if (explicitFile) {
    mkdirSync(dirname(explicitFile), { recursive: true });
    return explicitFile;
  }

  const dataDir = process.env.CATNOVEL_DATA_DIR ?? join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });
  return join(dataDir, "app.db");
}

function runStatement(db: DatabaseSync, statement: string) {
  db.prepare(statement).run();
}

function bootstrapDatabase(db: DatabaseSync) {
  runStatement(db, "PRAGMA journal_mode = WAL");
  runStatement(db, "PRAGMA foreign_keys = ON");
  runStatement(
    db,
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`,
  );

  const existing = new Set(
    db
      .prepare("SELECT id FROM schema_migrations")
      .all()
      .map((row) => (row as { id: string }).id),
  );

  const insertMigration = db.prepare(
    "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
  );

  for (const migration of schemaMigrations) {
    if (existing.has(migration.id)) {
      continue;
    }

    const now = new Date().toISOString();
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const statement of migration.statements) {
        runStatement(db, statement);
      }
      insertMigration.run(migration.id, now);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const statement of seedStatements) {
      runStatement(db, statement);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  const file = resolveDatabaseFile();
  const db = new DatabaseSync(file);
  bootstrapDatabase(db);

  const tables = db
    .prepare(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .get() as { count: number };

  dbInstance = db;
  dbStatus = {
    file,
    tables: tables.count,
    bootstrappedAt: new Date().toISOString(),
  };

  return dbInstance;
}

export function getDatabaseStatus() {
  if (!dbStatus) {
    getDatabase();
  }

  return dbStatus as DatabaseStatus;
}

export function closeDatabase() {
  if (!dbInstance) {
    return;
  }

  dbInstance.close();
  dbInstance = null;
  dbStatus = null;
}
