import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

const DEFAULT_DATABASE_PATH = "./.data/catnovel.sqlite";
const MIGRATIONS_DIRECTORY = path.join(process.cwd(), "src", "db", "migrations");
const MIGRATION_META_TABLE = "__catnovel_schema_migrations";

let sqliteConnection: Database.Database | null = null;
let appDatabase: AppDatabase | null = null;

function applySqlMigrations(connection: Database.Database): void {
  if (!fs.existsSync(MIGRATIONS_DIRECTORY)) {
    return;
  }

  connection.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_META_TABLE} (
      file_name TEXT PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIRECTORY)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  const hasAppliedStatement = connection.prepare(
    `SELECT 1 FROM ${MIGRATION_META_TABLE} WHERE file_name = ? LIMIT 1`,
  );
  const markAppliedStatement = connection.prepare(
    `INSERT INTO ${MIGRATION_META_TABLE} (file_name, applied_at) VALUES (?, ?)`,
  );

  for (const fileName of migrationFiles) {
    if (hasAppliedStatement.get(fileName)) {
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIRECTORY, fileName);
    const sql = fs.readFileSync(filePath, "utf8");

    try {
      connection.exec(sql);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isDuplicateColumnError = /duplicate column name/i.test(message);
      if (!isDuplicateColumnError) {
        throw error;
      }
      console.warn("[db] migration duplicate column detected, mark as applied", {
        fileName,
        message,
      });
    }

    markAppliedStatement.run(fileName, Date.now());
  }
}

function normalizeSqlitePath(rawPath: string): string {
  if (rawPath.startsWith("file:")) {
    return rawPath.slice("file:".length);
  }
  return rawPath;
}

function resolveDatabasePath(): string {
  const rawPath = process.env.DATABASE_URL ?? DEFAULT_DATABASE_PATH;
  if (rawPath === ":memory:") {
    return rawPath;
  }

  const normalizedPath = normalizeSqlitePath(rawPath);
  if (!path.isAbsolute(normalizedPath)) {
    return path.join(process.cwd(), normalizedPath);
  }

  return normalizedPath;
}

function ensureDatabaseDirectory(filePath: string): void {
  if (filePath === ":memory:") {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export function getSqliteConnection(): Database.Database {
  if (!sqliteConnection) {
    const databasePath = resolveDatabasePath();
    ensureDatabaseDirectory(databasePath);
    sqliteConnection = new Database(databasePath);
    sqliteConnection.pragma("foreign_keys = ON");
    sqliteConnection.pragma("journal_mode = WAL");
    applySqlMigrations(sqliteConnection);
  }

  return sqliteConnection;
}

export function getDatabase(): AppDatabase {
  if (!appDatabase) {
    appDatabase = drizzle(getSqliteConnection(), { schema });
  }
  return appDatabase;
}

export function runInTransaction<T>(handler: (tx: AppDatabase) => T): T {
  const db = getDatabase();
  return db.transaction((tx) => handler(tx as AppDatabase));
}
