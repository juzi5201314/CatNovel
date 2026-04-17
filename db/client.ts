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
  // 内存模式：用于测试环境，数据不会持久化到磁盘
  if (process.env.CATNOVEL_DB_MEMORY === 'true') {
    return ':memory:';
  }
  
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

export function withImmediateTransaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = run();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function shouldIgnoreMigrationError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("duplicate column name") ||
    error.message.includes("no such column") ||
    error.message.includes("already exists")
  );
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
    withImmediateTransaction(db, () => {
      for (const statement of migration.statements) {
        try {
          runStatement(db, statement);
        } catch (error) {
          if (!shouldIgnoreMigrationError(error)) {
            throw error;
          }
        }
      }
      insertMigration.run(migration.id, now);
    });
  }

  const hasExistingData = db.prepare("SELECT 1 FROM works LIMIT 1").get() !== undefined;
  if (!hasExistingData) {
    withImmediateTransaction(db, () => {
      for (const statement of seedStatements) {
        runStatement(db, statement);
      }
    });
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
