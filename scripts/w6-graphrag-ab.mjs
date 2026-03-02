#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

const baseUrl = process.env.CATNOVEL_BASE_URL ?? "http://127.0.0.1:3000";
const K = Number(process.env.RAG_K ?? 5);
const NOISE_SCORE_THRESHOLD = Number(process.env.RAG_NOISE_SCORE_THRESHOLD ?? 0.55);

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

function calcNoiseRatio(hits) {
  if (!Array.isArray(hits) || hits.length === 0) {
    return 1;
  }
  const noisy = hits.filter((hit) => {
    if (!hit || typeof hit !== "object") {
      return true;
    }
    const score = hit.score;
    if (typeof score !== "number" || !Number.isFinite(score)) {
      return true;
    }
    return score < NOISE_SCORE_THRESHOLD;
  }).length;
  return noisy / hits.length;
}

async function seedProject() {
  const project = await api("POST", "/api/projects", {
    name: `W6 GraphRAG AB ${Date.now()}`,
    mode: "webnovel",
  });

  const chapters = [
    {
      title: "第一章 雨夜急诊",
      content: "沈见在雨夜被医生林祁救下，两人互不相识。",
      summary: "沈见与林祁首次相遇。",
    },
    {
      title: "第二章 旧档案",
      content:
        "旧档案揭示林祁是沈见失散多年的哥哥，这层血缘关系改变了两人的立场。",
      summary: "沈见与林祁确认兄弟关系。",
    },
    {
      title: "第三章 合作调查",
      content:
        "警探周岚起初怀疑沈见，随后与他达成合作同盟，共同追查失踪案主谋。",
      summary: "周岚与沈见从对立转为合作。",
    },
    {
      title: "第四章 账本交易",
      content:
        "顾砚用账本勒索档案员许策，许策因此成为顾砚的利益同盟和内线。",
      summary: "顾砚与许策形成利益关系。",
    },
    {
      title: "第五章 暗巷协议",
      content:
        "周岚与林祁在暗巷签下互保协议，决定共同保护沈见并共享线索。",
      summary: "周岚与林祁建立协作关系。",
    },
  ];

  for (const chapterData of chapters) {
    const chapter = await api("POST", `/api/projects/${project.id}/chapters`, {
      title: chapterData.title,
    });
    await api("PATCH", `/api/chapters/${chapter.id}`, {
      content: chapterData.content,
      summary: chapterData.summary,
    });
  }

  await api("POST", "/api/rag/reindex", {
    projectId: project.id,
    reason: "full_rebuild",
  });
  await pollIndexStatus(project.id);
  return project;
}

async function runSuite({ projectId, endpoint, strategy, cases }) {
  let recallHits = 0;
  let usedGraphRagCount = 0;
  let failures = 0;
  let noiseSum = 0;
  const latencyMs = [];

  for (const sample of cases) {
    const startedAt = Date.now();
    try {
      const result = await api("POST", endpoint, {
        projectId,
        query: sample.query,
        strategy,
        topK: K,
      });
      latencyMs.push(Date.now() - startedAt);

      if (result.usedGraphRag) {
        usedGraphRagCount += 1;
      }

      const topHits = Array.isArray(result.hits) ? result.hits.slice(0, K) : [];
      if (topHits.some((hit) => hit.chapterNo === sample.expectedChapterNo)) {
        recallHits += 1;
      }
      noiseSum += calcNoiseRatio(topHits);
    } catch {
      failures += 1;
      noiseSum += 1;
    }
  }

  const total = cases.length;
  return {
    sampleSize: total,
    recallAtK: total === 0 ? 0 : Number((recallHits / total).toFixed(4)),
    avgNoiseRatio: total === 0 ? 0 : Number((noiseSum / total).toFixed(4)),
    usedGraphRagRate: total === 0 ? 0 : Number((usedGraphRagCount / total).toFixed(4)),
    p95LatencyMs: p95(latencyMs),
    failureRate: total === 0 ? 0 : Number((failures / total).toFixed(4)),
  };
}

async function main() {
  applyMigration();
  const project = await seedProject();

  const relationCases = [
    { query: "沈见和林祁是什么关系", expectedChapterNo: 2 },
    { query: "周岚和沈见最后是什么关系", expectedChapterNo: 3 },
    { query: "顾砚和许策之间是什么关系", expectedChapterNo: 4 },
    { query: "周岚为什么会和林祁合作", expectedChapterNo: 5 },
  ];

  const baseline = await runSuite({
    projectId: project.id,
    endpoint: "/api/rag/query",
    strategy: "vector_first",
    cases: relationCases,
  });

  const graphRag = await runSuite({
    projectId: project.id,
    endpoint: "/api/rag/relation",
    strategy: "auto",
    cases: relationCases,
  });

  const report = {
    k: K,
    noiseScoreThreshold: NOISE_SCORE_THRESHOLD,
    baseline,
    graphRag,
    deltas: {
      recallAtK: Number((graphRag.recallAtK - baseline.recallAtK).toFixed(4)),
      avgNoiseRatio: Number((graphRag.avgNoiseRatio - baseline.avgNoiseRatio).toFixed(4)),
      p95LatencyMs: graphRag.p95LatencyMs - baseline.p95LatencyMs,
    },
  };

  console.log("w6_graphrag_ab_ok=true");
  console.log(JSON.stringify(report));
}

main().catch((error) => {
  console.error("w6_graphrag_ab_ok=false");
  console.error(error);
  process.exitCode = 1;
});
