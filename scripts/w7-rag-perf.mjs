#!/usr/bin/env node

import assert from "node:assert/strict";

import { api, applyMigrations, p95, poll } from "./w7-test-utils.mjs";

const K = Number(process.env.RAG_K ?? 5);
const P95_BUDGET_MS = Number(process.env.RAG_P95_BUDGET_MS ?? 1500);
const FAILURE_RATE_MAX = Number(process.env.RAG_FAILURE_RATE_MAX ?? 0.1);
const RECALL_AT_K_MIN = Number(process.env.RAG_RECALL_AT_K_MIN ?? 0.75);

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`missing required env: ${name}`);
  }
  return value.trim();
}

function optionalEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

async function configureEmbedding(projectId) {
  const baseURL = optionalEnv("EMBEDDING_BASE_URL") ?? requireEnv("OPENAI_BASE_URL");
  const apiKey = optionalEnv("EMBEDDING_API_KEY") ?? requireEnv("API_KEY");
  const modelId = optionalEnv("EMBEDDING_MODEL") ?? "text-embedding-3-small";

  const provider = await api("POST", "/api/settings/providers", {
    name: `W7 Perf Embedding ${Date.now()}`,
    protocol: "openai_compatible",
    category: "embedding",
    baseURL,
    apiKey,
    enabled: true,
  });
  const preset = await api("POST", "/api/settings/model-presets", {
    providerId: provider.id,
    purpose: "embedding",
    apiFormat: "embeddings",
    modelId,
  });
  await api("PATCH", "/api/settings/llm-defaults", {
    projectId,
    defaultEmbeddingPresetId: preset.id,
  });
}

async function seedProject() {
  const project = await api("POST", "/api/projects", {
    name: `W7 RAG Perf ${Date.now()}`,
    mode: "webnovel",
  });
  await configureEmbedding(project.id);

  const chapters = [
    {
      title: "第一章 雨夜诊所",
      content: "第一章里医生林祁在旧城区诊所为主角处理伤口并留下联系方式。",
      summary: "医生林祁首次登场并处理伤口。",
    },
    {
      title: "第二章 档案室",
      content: "主角在档案室翻到林祁过去的病历，确认林祁参与过旧案调查。",
      summary: "档案室确认林祁身份与旧案关联。",
    },
    {
      title: "第三章 旧仓库",
      content: "第三章转场到旧仓库，主角发现失踪案关键证据并锁定嫌疑人。",
      summary: "旧仓库找到关键证据，案件推进。",
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

  await poll(
    async () => {
      const status = await api(
        "GET",
        `/api/rag/index-status?projectId=${encodeURIComponent(project.id)}`,
      );
      return status.pendingJobs === 0 ? status : null;
    },
    {
      timeoutMs: 20000,
      errorMessage: "rag perf reindex timeout",
    },
  );

  return project.id;
}

async function main() {
  applyMigrations();
  const projectId = await seedProject();

  const cases = [
    { query: "第一章出现的医生是谁", expectedChapterNo: 1 },
    { query: "档案室查到了谁的病历", expectedChapterNo: 2 },
    { query: "旧仓库发生了什么", expectedChapterNo: 3 },
    { query: "失踪案关键证据在哪一章", expectedChapterNo: 3 },
  ];

  const latencies = [];
  let recallHits = 0;
  let failures = 0;

  for (const sample of cases) {
    const startedAt = Date.now();
    try {
      const result = await api("POST", "/api/rag/query", {
        projectId,
        query: sample.query,
        strategy: "auto",
        topK: K,
      });
      latencies.push(Date.now() - startedAt);

      const chapterNos = Array.isArray(result.hits)
        ? result.hits.slice(0, K).map((item) => item.chapterNo)
        : [];
      if (chapterNos.includes(sample.expectedChapterNo)) {
        recallHits += 1;
      }
    } catch {
      failures += 1;
    }
  }

  const sampleSize = cases.length;
  const report = {
    sampleSize,
    k: K,
    recallAtK: Number((recallHits / sampleSize).toFixed(4)),
    p95LatencyMs: p95(latencies),
    failureRate: Number((failures / sampleSize).toFixed(4)),
  };

  assert.ok(
    report.p95LatencyMs <= P95_BUDGET_MS,
    `p95 latency ${report.p95LatencyMs}ms exceeds budget ${P95_BUDGET_MS}ms`,
  );
  assert.ok(
    report.failureRate <= FAILURE_RATE_MAX,
    `failureRate ${report.failureRate} exceeds max ${FAILURE_RATE_MAX}`,
  );
  assert.ok(
    report.recallAtK >= RECALL_AT_K_MIN,
    `recallAtK ${report.recallAtK} below min ${RECALL_AT_K_MIN}`,
  );

  console.log("w7_rag_perf_ok=true");
  console.log(JSON.stringify(report));
}

main().catch((error) => {
  console.error("w7_rag_perf_ok=false");
  console.error(error);
  process.exitCode = 1;
});
