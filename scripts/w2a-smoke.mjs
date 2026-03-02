#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const baseUrl = process.env.CATNOVEL_BASE_URL ?? "http://127.0.0.1:3000";
const defaultDbPath = path.join(process.cwd(), ".data", "catnovel.sqlite");

function applyMigration() {
  const migrationPath = path.join(
    process.cwd(),
    "src",
    "db",
    "migrations",
    "0000_w1a_init.sql",
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  const dbDir = path.dirname(defaultDbPath);
  fs.mkdirSync(dbDir, { recursive: true });
  const db = new Database(defaultDbPath);
  db.exec(migrationSql);
  db.close();
}

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    throw new Error(
      `request failed ${init?.method ?? "GET"} ${path}: ${JSON.stringify(payload)}`,
    );
  }

  return payload.data;
}

async function main() {
  applyMigration();

  const project = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      name: `Smoke Project ${Date.now()}`,
      mode: "webnovel",
    }),
  });

  const chapter = await request(`/api/projects/${project.id}/chapters`, {
    method: "POST",
    body: JSON.stringify({
      title: "Smoke Chapter 1",
    }),
  });

  const updated = await request(`/api/chapters/${chapter.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      content: "Smoke content",
      summary: "Smoke summary",
    }),
  });

  if (updated.content !== "Smoke content") {
    throw new Error("chapter content mismatch after PATCH");
  }

  console.log("w2a_smoke_ok=true");
  console.log(`project_id=${project.id}`);
  console.log(`chapter_id=${chapter.id}`);
}

main().catch((error) => {
  console.error("w2a_smoke_ok=false");
  console.error(error);
  process.exitCode = 1;
});
