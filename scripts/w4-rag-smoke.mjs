#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

const baseUrl = process.env.CATNOVEL_BASE_URL ?? "http://127.0.0.1:3000";

function applyMigration() {
  const migrationPath = path.join(
    process.cwd(),
    "src",
    "db",
    "migrations",
    "0000_w1a_init.sql",
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  const dbPath = path.join(process.cwd(), ".data", "catnovel.sqlite");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec(migrationSql);
  db.close();
}

async function api(method, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(`${method} ${route} failed: ${JSON.stringify(json)}`);
  }
  return json.data;
}

async function pollIndexStatus(projectId, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const status = await api(
      "GET",
      `/api/rag/index-status?projectId=${encodeURIComponent(projectId)}`,
    );
    if ((status.pendingJobs ?? 0) === 0) {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("rag reindex timeout");
}

async function main() {
  applyMigration();

  const project = await api("POST", "/api/projects", {
    name: `W4 Smoke ${Date.now()}`,
    mode: "webnovel",
  });

  const chapter1 = await api("POST", `/api/projects/${project.id}/chapters`, {
    title: "第一章 雨夜",
  });
  await api("PATCH", `/api/chapters/${chapter1.id}`, {
    content: "雨夜里医生林祁第一次出现在旧城区诊所。",
    summary: "医生林祁首次登场。",
  });

  const chapter2 = await api("POST", `/api/projects/${project.id}/chapters`, {
    title: "第二章 线索",
  });
  await api("PATCH", `/api/chapters/${chapter2.id}`, {
    content: "主角回忆第一章的医生林祁，并在档案室找到相关病历。",
    summary: "医生线索延续。",
  });

  await api("POST", "/api/rag/reindex", {
    projectId: project.id,
    reason: "full_rebuild",
  });

  const indexStatus = await pollIndexStatus(project.id);

  const ragAnswer = await api("POST", "/api/rag/query", {
    projectId: project.id,
    query: "第一章出现的医生是谁",
    chapterScope: { from: 1, to: 2 },
    strategy: "auto",
  });

  const embedResult = await api("POST", "/api/rag/embed", {
    projectId: project.id,
    texts: ["医生林祁", "旧城区诊所"],
  });

  if (!Array.isArray(ragAnswer.hits) || ragAnswer.hits.length === 0) {
    throw new Error("rag query must return hits");
  }
  if (!Array.isArray(embedResult.vectors) || embedResult.vectors.length !== 2) {
    throw new Error("embed result invalid");
  }

  console.log("w4_rag_smoke_ok=true");
  console.log(`indexed_chapters=${indexStatus.indexedChapters}`);
  console.log(`hit_count=${ragAnswer.hits.length}`);
}

main().catch((error) => {
  console.error("w4_rag_smoke_ok=false");
  console.error(error);
  process.exitCode = 1;
});
