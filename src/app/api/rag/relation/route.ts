import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import type { ChapterScope, RetrievalQueryInput } from "@/core/retrieval/contracts";
import { HybridRetriever } from "@/core/retrieval/hybrid-retriever";

type RelationQueryRequest = RetrievalQueryInput;

const retriever = new HybridRetriever();

function isIntentStrategy(value: unknown): value is RelationQueryRequest["strategy"] {
  return value === "auto" || value === "vector_first" || value === "alias_first";
}

function parseChapterScope(value: unknown): ChapterScope | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const from = record.from;
  const to = record.to;
  if (from !== undefined && !Number.isInteger(from)) {
    return undefined;
  }
  if (to !== undefined && !Number.isInteger(to)) {
    return undefined;
  }
  const scope: ChapterScope = {};
  if (Number.isInteger(from)) {
    scope.from = from as number;
  }
  if (Number.isInteger(to)) {
    scope.to = to as number;
  }
  if (scope.from !== undefined && scope.to !== undefined && scope.from > scope.to) {
    return undefined;
  }
  return scope;
}

function validateRelationRequest(payload: unknown): RelationQueryRequest | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.projectId !== "string" || record.projectId.trim().length === 0) {
    return null;
  }
  if (typeof record.query !== "string" || record.query.trim().length === 0) {
    return null;
  }

  const chapterScope = parseChapterScope(record.chapterScope);
  if (record.chapterScope !== undefined && !chapterScope) {
    return null;
  }

  let topK: number | undefined;
  if (record.topK !== undefined) {
    if (!Number.isInteger(record.topK) || (record.topK as number) <= 0) {
      return null;
    }
    topK = record.topK as number;
  }

  let strategy: RelationQueryRequest["strategy"] = "auto";
  if (record.strategy !== undefined) {
    if (!isIntentStrategy(record.strategy)) {
      return null;
    }
    strategy = record.strategy;
  }

  return {
    projectId: record.projectId.trim(),
    query: record.query.trim(),
    chapterScope,
    strategy,
    topK,
  };
}

export async function POST(request: Request) {
  try {
    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const input = validateRelationRequest(bodyResult.data);
    if (!input) {
      return fail(
        "INVALID_INPUT",
        "projectId/query required and chapterScope/topK/strategy format must be valid",
        400,
      );
    }

    const result = await retriever.queryRelation(input);
    return ok({
      answer: result.answer,
      usedGraphRag: result.usedGraphRag,
      hits: result.hits,
      events: result.events,
    });
  } catch (error) {
    return internalError(error);
  }
}
