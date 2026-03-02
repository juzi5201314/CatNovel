import type {
  CreateIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  DeleteVectorsParams,
  DescribeIndexParams,
  IndexStats,
  MastraEmbeddingModel,
  QueryResult,
  QueryVectorParams,
  UpdateVectorParams,
  UpsertVectorParams,
} from "@mastra/core/vector";
import { MastraVector } from "@mastra/core/vector";
import { createGraphRAGTool } from "@mastra/rag";

import { CHUNK_TABLE_NAME, type ChunkType, type ChunkVectorRecord } from "./chunk-schema";
import type { ChapterScope, EvidenceHit } from "./contracts";
import { embedText, embeddingDimensions } from "./embedding";
import { getProjectChunks } from "./runtime";

type GraphRagSource = {
  score?: unknown;
  metadata?: unknown;
  document?: unknown;
};

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

const LOCAL_EMBEDDING_MODEL: MastraEmbeddingModel<string> = {
  specificationVersion: "v2",
  provider: "catnovel",
  modelId: "catnovel-runtime-embed-v1",
  maxEmbeddingsPerCall: 128,
  supportsParallelCalls: true,
  doEmbed: async (options: { values: string[] }) => {
    const embeddings = options.values.map((value: string) => embedText(String(value)));
    const tokenCount = options.values.reduce(
      (sum: number, value: string) => sum + String(value).length,
      0,
    );
    return {
      embeddings,
      usage: {
        tokens: tokenCount,
      },
    };
  },
};

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

function inScope(chunk: ChunkVectorRecord, scope: ChapterScope | undefined): boolean {
  if (scope?.from !== undefined && chunk.chapter_no < scope.from) {
    return false;
  }
  if (scope?.to !== undefined && chunk.chapter_no > scope.to) {
    return false;
  }
  return true;
}

function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let normLeft = 0;
  let normRight = 0;
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    normLeft += a * a;
    normRight += b * b;
  }
  if (normLeft === 0 || normRight === 0) {
    return 0;
  }
  const similarity = dot / Math.sqrt(normLeft * normRight);
  return Math.max(-1, Math.min(1, similarity));
}

function clampSnippet(text: string, maxLength = 180): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function normalizeGraphScore(rawScore: number): number {
  if (!Number.isFinite(rawScore)) {
    return 0;
  }
  const logistic = 1 / (1 + Math.exp(-rawScore * 3));
  return Number(logistic.toFixed(6));
}

function parseChunkType(value: unknown): ChunkType {
  if (typeof value === "string" && CHUNK_TYPES.has(value as ChunkType)) {
    return value as ChunkType;
  }
  return "content";
}

function toInt(value: unknown): number | null {
  if (!Number.isInteger(value)) {
    return null;
  }
  return value as number;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseGraphSources(sources: unknown): EvidenceHit[] {
  if (!Array.isArray(sources)) {
    return [];
  }

  const hits: EvidenceHit[] = [];
  for (const source of sources) {
    const item = source as GraphRagSource;
    const metadata = toRecord(item.metadata);
    if (!metadata) {
      continue;
    }

    const chapterNo = toInt(metadata.chapter_no);
    const chapterId = typeof metadata.chapter_id === "string" ? metadata.chapter_id : null;
    const chunkId = typeof metadata.chunk_id === "string" ? metadata.chunk_id : null;
    if (chapterNo === null || !chapterId || !chunkId) {
      continue;
    }

    const document =
      typeof item.document === "string"
        ? item.document
        : typeof metadata.text === "string"
          ? metadata.text
          : "";
    const rawScore = typeof item.score === "number" ? item.score : 0;

    hits.push({
      chapterNo,
      chapterId,
      chunkId,
      score: normalizeGraphScore(rawScore),
      snippet: clampSnippet(document),
      chunkType: parseChunkType(metadata.chunk_type),
      source: "vector",
    });
  }

  return hits.sort((left, right) => right.score - left.score);
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

class RuntimeChunkVectorStore extends MastraVector {
  constructor(private readonly chunks: ChunkVectorRecord[]) {
    super({ id: "catnovel-runtime-chunk-vector" });
  }

  async query(params: QueryVectorParams): Promise<QueryResult[]> {
    const queryVector = params.queryVector;
    if (!queryVector || queryVector.length === 0) {
      return [];
    }

    const topK = Number.isInteger(params.topK) && (params.topK as number) > 0 ? (params.topK as number) : 10;
    return this.chunks
      .map((chunk) => {
        const similarity = cosineSimilarity(queryVector, chunk.vector);
        const metadata = {
          project_id: chunk.project_id,
          chapter_no: chunk.chapter_no,
          chapter_id: chunk.chapter_id,
          chunk_id: chunk.chunk_id,
          chunk_type: chunk.chunk_type,
          text: chunk.text,
        };
        return {
          id: chunk.chunk_id,
          score: Number(similarity.toFixed(6)),
          metadata,
          document: chunk.text,
          vector: params.includeVector ? chunk.vector : undefined,
        } satisfies QueryResult;
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, topK);
  }

  async upsert(params: UpsertVectorParams): Promise<string[]> {
    void params;
    return [];
  }

  async createIndex(params: CreateIndexParams): Promise<void> {
    void params;
    return;
  }

  async listIndexes(): Promise<string[]> {
    return [CHUNK_TABLE_NAME];
  }

  async describeIndex(params: DescribeIndexParams): Promise<IndexStats> {
    void params;
    return {
      dimension: embeddingDimensions(),
      count: this.chunks.length,
      metric: "cosine",
    };
  }

  async deleteIndex(params: DeleteIndexParams): Promise<void> {
    void params;
    return;
  }

  async updateVector(params: UpdateVectorParams): Promise<void> {
    void params;
    return;
  }

  async deleteVector(params: DeleteVectorParams): Promise<void> {
    void params;
    return;
  }

  async deleteVectors(params: DeleteVectorsParams): Promise<void> {
    void params;
    return;
  }
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
  const chunks = getProjectChunks(input.projectId).filter((chunk) => inScope(chunk, input.chapterScope));
  if (chunks.length === 0) {
    return {
      executed: false,
      accepted: false,
      hits: [],
      noiseRatio: 1,
    };
  }

  const graphTool = createGraphRAGTool({
    vectorStore: new RuntimeChunkVectorStore(chunks),
    indexName: CHUNK_TABLE_NAME,
    model: LOCAL_EMBEDDING_MODEL,
    includeSources: true,
    graphOptions: {
      dimension: embeddingDimensions(),
      randomWalkSteps: input.config.randomWalkSteps,
      restartProb: input.config.restartProb,
      threshold: input.config.edgeThreshold,
    },
  });

  const execute = graphTool.execute;
  if (!execute) {
    return {
      executed: false,
      accepted: false,
      hits: [],
      noiseRatio: 1,
    };
  }

  const output = await execute(
    {
      queryText: input.query,
      topK: input.topK,
    },
    {},
  );

  const sources = toRecord(output)?.sources;
  const hits = parseGraphSources(sources);
  const noiseRatio = calculateNoiseRatio(hits, input.config.noiseScoreThreshold);

  return {
    executed: true,
    accepted: hits.length > 0 && noiseRatio <= input.config.noiseMaxRatio,
    hits,
    noiseRatio,
  };
}
