#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

export const baseUrl = process.env.CATNOVEL_BASE_URL ?? "http://127.0.0.1:3000";

const dbPath = path.join(process.cwd(), ".data", "catnovel.sqlite");
const migrationDirectory = path.join(process.cwd(), "src", "db", "migrations");
const migrationMetaTable = "__catnovel_schema_migrations";

function listMigrationFiles() {
  if (!fs.existsSync(migrationDirectory)) {
    return [];
  }

  return fs
    .readdirSync(migrationDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => path.join(migrationDirectory, fileName));
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function applyMigrations() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  const migrationFiles = listMigrationFiles();

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${migrationMetaTable} (
        file_name TEXT PRIMARY KEY NOT NULL,
        applied_at INTEGER NOT NULL
      );
    `);
    const hasAppliedStatement = db.prepare(
      `SELECT 1 FROM ${migrationMetaTable} WHERE file_name = ? LIMIT 1`,
    );
    const markAppliedStatement = db.prepare(
      `INSERT OR REPLACE INTO ${migrationMetaTable} (file_name, applied_at) VALUES (?, ?)`,
    );

    for (const migrationFile of migrationFiles) {
      const fileName = path.basename(migrationFile);
      if (hasAppliedStatement.get(fileName)) {
        continue;
      }
      const sql = fs.readFileSync(migrationFile, "utf8");
      db.exec(sql);
      markAppliedStatement.run(fileName, Date.now());
    }
  } finally {
    db.close();
  }
}

export async function api(method, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? safeJsonParse(await response.text())
    : await response.text();

  if (!response.ok || !payload || payload.success !== true) {
    throw new Error(
      `${method} ${route} failed (${response.status}): ${JSON.stringify(payload)}`,
    );
  }

  return payload.data;
}

export async function poll(check, options = {}) {
  const timeoutMs = options.timeoutMs ?? 15000;
  const intervalMs = options.intervalMs ?? 200;
  const errorMessage = options.errorMessage ?? "poll timeout";

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await check();
    if (result) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(errorMessage);
}

function parseSseFrame(frame) {
  let event = "message";
  const dataLines = [];

  const lines = frame
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const dataText = dataLines.join("\n");
  return {
    event,
    data: safeJsonParse(dataText),
    raw: dataText,
  };
}

async function readWithTimeout(reader, timeoutMs) {
  return Promise.race([
    reader.read(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("sse read timeout")), timeoutMs);
    }),
  ]);
}

export async function readSseEvents(response, options = {}) {
  if (!response.body) {
    throw new Error("missing response body for SSE stream");
  }

  const stopEvent = options.stopEvent;
  const maxEvents = options.maxEvents ?? Number.POSITIVE_INFINITY;
  const timeoutMs = options.timeoutMs ?? 8000;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buffer = "";

  try {
    while (events.length < maxEvents) {
      const chunk = await readWithTimeout(reader, timeoutMs);
      if (chunk.done) {
        break;
      }
      buffer += decoder.decode(chunk.value, { stream: true });

      while (true) {
        const index = buffer.indexOf("\n\n");
        if (index === -1) {
          break;
        }

        const frame = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const parsed = parseSseFrame(frame);
        if (!parsed) {
          continue;
        }

        events.push(parsed);
        if (parsed.event === stopEvent || events.length >= maxEvents) {
          await reader.cancel();
          return events;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return events;
}

export function p95(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx];
}
