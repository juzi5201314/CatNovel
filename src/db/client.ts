import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

const DEFAULT_DATABASE_PATH = "./.data/catnovel.sqlite";
const MIGRATIONS_DIRECTORY = path.join(process.cwd(), "src", "db", "migrations");

let sqliteConnection: Database.Database | null = null;
let appDatabase: AppDatabase | null = null;

function applySqlMigrations(connection: Database.Database): void {
  if (!fs.existsSync(MIGRATIONS_DIRECTORY)) {
    return;
  }

  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIRECTORY)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  for (const fileName of migrationFiles) {
    const filePath = path.join(MIGRATIONS_DIRECTORY, fileName);
    const sql = fs.readFileSync(filePath, "utf8");
    connection.exec(sql);
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
