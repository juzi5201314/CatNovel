import type { ChunkType } from "./chunk-schema";
import type { ChapterScope, EvidenceHit } from "./contracts";
import { embedText } from "./embedding";
import { LanceDbVectorStore } from "./vector-store";

export type GraphRagRuntimeConfig = {
  enabled: boolean;
  relationOnly: boolean;
  fallbackToVector: boolean;
  edgeThreshold: number;
  randomWalkSteps: number;
  restartProb: number;
  noiseScoreThreshold: number;
  noiseMaxRatio: number;
};

export type GraphRagRuntimeInput = {
  projectId: string;
  query: string;
  topK: number;
  chapterScope?: ChapterScope;
  config: GraphRagRuntimeConfig;
};

export type GraphRagRuntimeOutput = {
  executed: boolean;
  accepted: boolean;
  hits: EvidenceHit[];
  noiseRatio: number;
};

const DEFAULT_GRAPH_RAG_CONFIG: GraphRagRuntimeConfig = {
  enabled: true,
  relationOnly: true,
  fallbackToVector: true,
  edgeThreshold: 0.7,
  randomWalkSteps: 120,
  restartProb: 0.18,
  noiseScoreThreshold: 0.55,
  noiseMaxRatio: 0.45,
};

const CHUNK_TYPES = new Set<ChunkType>(["content", "summary", "event", "lore"]);
const vectorStore = new LanceDbVectorStore();

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function readNumberEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function clampSnippet(text: string, maxLength = 180): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function parseChunkType(value: unknown): ChunkType {
  if (typeof value === "string" && CHUNK_TYPES.has(value as ChunkType)) {
    return value as ChunkType;
  }
  return "content";
}

function normalizeScore(distance: number): number {
  const semantic = 1 / (1 + Math.max(0, distance));
  return Number(semantic.toFixed(6));
}

function calculateNoiseRatio(hits: EvidenceHit[], scoreThreshold: number): number {
  if (hits.length === 0) {
    return 1;
  }
  let noisy = 0;
  for (const hit of hits) {
    const lowScore = hit.score < scoreThreshold;
    const shortSnippet = hit.snippet.trim().length < 10;
    if (lowScore || shortSnippet) {
      noisy += 1;
    }
  }
  return Number((noisy / hits.length).toFixed(6));
}

export function readGraphRagRuntimeConfig(): GraphRagRuntimeConfig {
  return {
    enabled: readBooleanEnv("RAG_GRAPH_ENABLED", DEFAULT_GRAPH_RAG_CONFIG.enabled),
    relationOnly: readBooleanEnv("RAG_GRAPH_RELATION_ONLY", DEFAULT_GRAPH_RAG_CONFIG.relationOnly),
    fallbackToVector: readBooleanEnv(
      "RAG_GRAPH_FALLBACK_TO_VECTOR",
      DEFAULT_GRAPH_RAG_CONFIG.fallbackToVector,
    ),
    edgeThreshold: readNumberEnv(
      "RAG_GRAPH_EDGE_THRESHOLD",
      DEFAULT_GRAPH_RAG_CONFIG.edgeThreshold,
      0.1,
      0.99,
    ),
    randomWalkSteps: Math.round(
      readNumberEnv(
        "RAG_GRAPH_RANDOM_WALK_STEPS",
        DEFAULT_GRAPH_RAG_CONFIG.randomWalkSteps,
        10,
        600,
      ),
    ),
    restartProb: readNumberEnv(
      "RAG_GRAPH_RESTART_PROB",
      DEFAULT_GRAPH_RAG_CONFIG.restartProb,
      0.01,
      0.95,
    ),
    noiseScoreThreshold: readNumberEnv(
      "RAG_GRAPH_NOISE_SCORE_THRESHOLD",
      DEFAULT_GRAPH_RAG_CONFIG.noiseScoreThreshold,
      0,
      1,
    ),
    noiseMaxRatio: readNumberEnv(
      "RAG_GRAPH_NOISE_MAX_RATIO",
      DEFAULT_GRAPH_RAG_CONFIG.noiseMaxRatio,
      0,
      1,
    ),
  };
}

export async function runGraphRagRuntimeQuery(
  input: GraphRagRuntimeInput,
): Promise<GraphRagRuntimeOutput> {
  if (!input.config.enabled) {
    return {
      executed: false,
      accepted: false,
      hits: [],
      noiseRatio: 1,
    };
  }

  const queryVector = await embedText(input.query, { projectId: input.projectId });
  if (queryVector.length === 0) {
    return {
      executed: false,
      accepted: false,
      hits: [],
      noiseRatio: 1,
    };
  }

  const rows = await vectorStore.queryNearest(
    {
      projectId: input.projectId,
      vector: queryVector,
      limit: Math.max(input.topK * 2, input.topK),
    },
    input.chapterScope,
  );

  if (rows.length === 0) {
    return {
      executed: true,
      accepted: false,
      hits: [],
      noiseRatio: 1,
    };
  }

  const hits: EvidenceHit[] = rows.slice(0, input.topK).map((row) => ({
    chapterNo: row.chapter_no,
    chapterId: row.chapter_id,
    chunkId: row.chunk_id,
    score: normalizeScore(row.score),
    snippet: clampSnippet(row.text),
    chunkType: parseChunkType(row.chunk_type),
    source: "vector",
  }));

  const noiseRatio = calculateNoiseRatio(hits, input.config.noiseScoreThreshold);
  return {
    executed: true,
    accepted: hits.length > 0 && noiseRatio <= input.config.noiseMaxRatio,
    hits,
    noiseRatio,
  };
}
