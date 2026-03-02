#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

const baseUrl = process.env.CATNOVEL_BASE_URL ?? "http://127.0.0.1:3000";
const K = Number(process.env.RAG_K ?? 5);

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
    headers: { "content-type": "application/json" },
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

function p95(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx];
}

async function seedProject() {
  const project = await api("POST", "/api/projects", {
    name: `W4 Metrics ${Date.now()}`,
    mode: "webnovel",
  });

  const chapters = [
    {
      title: "第一章 雨夜诊所",
      content: "第一章里医生林祁在旧城区诊所为主角处理伤口。",
      summary: "医生林祁首次登场。",
    },
    {
      title: "第二章 档案室",
      content: "主角在档案室翻到林祁过去的病历，确认其身份。",
      summary: "身份线索延续。",
    },
    {
      title: "第三章 旧仓库",
      content: "第三章转场到旧仓库，涉及失踪案关键证据。",
      summary: "案件线索推进。",
    },
  ];

  for (const item of chapters) {
    const chapter = await api("POST", `/api/projects/${project.id}/chapters`, {
      title: item.title,
    });
    await api("PATCH", `/api/chapters/${chapter.id}`, {
      content: item.content,
      summary: item.summary,
    });
  }

  await api("POST", "/api/rag/reindex", {
    projectId: project.id,
    reason: "full_rebuild",
  });
  await pollIndexStatus(project.id);
  return project;
}

async function main() {
  applyMigration();
  const project = await seedProject();

  const cases = [
    { query: "第一章出现的医生是谁", expectedChapterNo: 1 },
    { query: "档案室查到了谁的病历", expectedChapterNo: 2 },
    { query: "旧仓库发生了什么", expectedChapterNo: 3 },
    { query: "失踪案证据在哪一章", expectedChapterNo: 3 },
  ];

  let recallHits = 0;
  let precisionHits = 0;
  let failures = 0;
  const latencyMs = [];

  for (const sample of cases) {
    const started = Date.now();
    try {
      const result = await api("POST", "/api/rag/query", {
        projectId: project.id,
        query: sample.query,
        strategy: "auto",
        topK: K,
      });
      const elapsed = Date.now() - started;
      latencyMs.push(elapsed);

      const topHits = Array.isArray(result.hits) ? result.hits.slice(0, K) : [];
      const chapterNos = topHits.map((hit) => hit.chapterNo);
      if (chapterNos.includes(sample.expectedChapterNo)) {
        recallHits += 1;
      }
      if (topHits[0]?.chapterNo === sample.expectedChapterNo) {
        precisionHits += 1;
      }
    } catch {
      failures += 1;
    }
  }

  const total = cases.length;
  const recallAtK = total === 0 ? 0 : recallHits / total;
  const evidencePrecision = total === 0 ? 0 : precisionHits / total;
  const failureRate = total === 0 ? 0 : failures / total;

  const report = {
    sampleSize: total,
    k: K,
    recallAtK: Number(recallAtK.toFixed(4)),
    evidencePrecision: Number(evidencePrecision.toFixed(4)),
    p95LatencyMs: p95(latencyMs),
    failureRate: Number(failureRate.toFixed(4)),
  };

  console.log("w4_rag_metrics_ok=true");
  console.log(JSON.stringify(report));
}

main().catch((error) => {
  console.error("w4_rag_metrics_ok=false");
  console.error(error);
  process.exitCode = 1;
});
