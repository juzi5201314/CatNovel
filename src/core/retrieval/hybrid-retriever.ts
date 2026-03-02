import { ChaptersRepository } from "@/repositories/chapters-repository";
import { TimelineRepository } from "@/repositories/timeline-repository";

import type {
  EvidenceHit,
  RagAnswer,
  RetrievalIntent,
  RetrievalQueryInput,
  TimelineEvent,
} from "./contracts";
import { assembleRagAnswer } from "./context-assembler";
import { DEFAULT_TOP_K, DEFAULT_VECTOR_CANDIDATES } from "./default-params";
import { embedText } from "./embedding";
import {
  readGraphRagRuntimeConfig,
  runGraphRagRuntimeQuery,
} from "./graph-rag-runtime";
import { reRankCandidates, type RankedCandidate } from "./re-ranker";
import { LanceDbVectorStore, type ChapterScope as VectorChapterScope } from "./vector-store";

const RELATION_KEYWORDS = ["关系", "关联", "联系", "与", "谁是", "between"];
const CREATIVE_KEYWORDS = ["续写", "改写", "润色", "扩写", "继续写", "rewrite", "continue"];

function classifyIntent(query: string): RetrievalIntent {
  const normalized = query.toLowerCase();
  if (CREATIVE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "creative";
  }
  if (RELATION_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "relation";
  }
  return "fact";
}

function clampSnippet(text: string, maxLength = 180): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}…`;
}

function toSemanticScore(distance: number): number {
  return 1 / (1 + Math.max(0, distance));
}

function tokenizeAlias(query: string): string[] {
  return query
    .split(/[\s,，。！？；:：/]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function toVectorScope(scope: RetrievalQueryInput["chapterScope"]): VectorChapterScope | undefined {
  if (!scope) {
    return undefined;
  }
  const nextScope: VectorChapterScope = {};
  if (scope.from !== undefined) {
    nextScope.from = scope.from;
  }
  if (scope.to !== undefined) {
    nextScope.to = scope.to;
  }
  return nextScope.from === undefined && nextScope.to === undefined ? undefined : nextScope;
}

export class HybridRetriever {
  constructor(
    private readonly chapterRepository = new ChaptersRepository(),
    private readonly timelineRepository = new TimelineRepository(),
    private readonly vectorStore = new LanceDbVectorStore(),
  ) {}

  async query(input: RetrievalQueryInput): Promise<RagAnswer> {
    const intent = classifyIntent(input.query);
    return this.queryWithIntent(input, intent);
  }

  async queryRelation(input: RetrievalQueryInput): Promise<RagAnswer> {
    return this.queryWithIntent(input, "relation");
  }

  private async queryWithIntent(
    input: RetrievalQueryInput,
    intent: RetrievalIntent,
  ): Promise<RagAnswer> {
    const topK = input.topK ?? DEFAULT_TOP_K;
    const fallbackHits = await this.retrieveFallbackHits(input, topK);
    const graphConfig = readGraphRagRuntimeConfig();
    const canUseGraphRag =
      graphConfig.enabled &&
      input.strategy === "auto" &&
      (!graphConfig.relationOnly || intent === "relation");

    if (canUseGraphRag) {
      const graphResult = await runGraphRagRuntimeQuery({
        projectId: input.projectId,
        query: input.query,
        topK,
        chapterScope: input.chapterScope,
        config: graphConfig,
      });

      if (graphResult.accepted) {
        const graphEvents = this.resolveTimelineEvents(input.projectId, graphResult.hits, topK);
        return assembleRagAnswer({
          query: input.query,
          intent,
          hits: graphResult.hits,
          events: graphEvents,
          usedGraphRag: true,
        });
      }

      if (!graphConfig.fallbackToVector && graphResult.executed) {
        const graphEvents = this.resolveTimelineEvents(input.projectId, graphResult.hits, topK);
        return assembleRagAnswer({
          query: input.query,
          intent,
          hits: graphResult.hits,
          events: graphEvents,
          usedGraphRag: true,
        });
      }
    }

    const fallbackEvents = this.resolveTimelineEvents(input.projectId, fallbackHits, topK);
    return assembleRagAnswer({
      query: input.query,
      intent,
      hits: fallbackHits,
      events: fallbackEvents,
      usedGraphRag: false,
    });
  }

  private async retrieveFallbackHits(input: RetrievalQueryInput, topK: number): Promise<EvidenceHit[]> {
    const queryVector = await embedText(input.query, { projectId: input.projectId });
    if (queryVector.length === 0) {
      return [];
    }
    const candidates: RankedCandidate[] = [];

    const vectorHits = (
      await this.vectorStore.queryNearest(
        {
          projectId: input.projectId,
          vector: queryVector,
          limit: DEFAULT_VECTOR_CANDIDATES,
        },
        toVectorScope(input.chapterScope),
      )
    )
      .map((item) => ({
        chapter_no: item.chapter_no,
        chapter_id: item.chapter_id,
        chunk_id: item.chunk_id,
        chunk_type: item.chunk_type,
        text: item.text,
        score: item.score,
      }));

    for (const hit of vectorHits) {
      candidates.push({
        chapterNo: hit.chapter_no,
        chapterId: hit.chapter_id,
        chunkId: hit.chunk_id,
        snippet: clampSnippet(hit.text),
        chunkType: hit.chunk_type,
        semanticScore: toSemanticScore(hit.score),
        aliasMatched: false,
        source: "vector",
      });
    }

    const aliasTerms = tokenizeAlias(input.query);
    if (aliasTerms.length > 0) {
      const chapters = this.chapterRepository.listByProject(input.projectId);
      for (const chapter of chapters) {
        if (
          input.chapterScope?.from !== undefined &&
          chapter.orderNo < input.chapterScope.from
        ) {
          continue;
        }
        if (input.chapterScope?.to !== undefined && chapter.orderNo > input.chapterScope.to) {
          continue;
        }

        const matchedTerm = aliasTerms.find((term) => chapter.content.includes(term));
        if (!matchedTerm) {
          continue;
        }

        const index = chapter.content.indexOf(matchedTerm);
        const snippet = clampSnippet(chapter.content.slice(Math.max(0, index - 60), index + 120));
        candidates.push({
          chapterNo: chapter.orderNo,
          chapterId: chapter.id,
          chunkId: `${chapter.id}:alias:${matchedTerm}`,
          snippet,
          chunkType: "content",
          semanticScore: 0.7,
          aliasMatched: true,
          source: "alias",
        });
      }
    }

    const dedup = new Map<string, RankedCandidate>();
    for (const candidate of candidates) {
      const key = `${candidate.chapterId}:${candidate.chunkId}`;
      const existing = dedup.get(key);
      if (!existing || candidate.semanticScore > existing.semanticScore) {
        dedup.set(key, candidate);
      }
    }

    const ranked = reRankCandidates({
      currentChapterNo: input.chapterScope?.to,
      candidates: [...dedup.values()],
    }).slice(0, topK);

    const hits: EvidenceHit[] = ranked.map((candidate) => ({
      chapterNo: candidate.chapterNo,
      chapterId: candidate.chapterId,
      chunkId: candidate.chunkId,
      score: candidate.semanticScore,
      snippet: candidate.snippet,
      chunkType: candidate.chunkType,
      source: candidate.source,
    }));

    return hits;
  }

  private resolveTimelineEvents(
    projectId: string,
    hits: EvidenceHit[],
    topK: number,
  ): TimelineEvent[] {
    if (hits.length === 0) {
      return [];
    }

    const chapterScoreMap = new Map<number, number>();
    for (const hit of hits) {
      const existing = chapterScoreMap.get(hit.chapterNo) ?? 0;
      if (hit.score > existing) {
        chapterScoreMap.set(hit.chapterNo, hit.score);
      }
    }

    const chapterOrders = [...chapterScoreMap.keys()];
    const eventRows = this.timelineRepository.listEventsByChapterOrders(
      projectId,
      chapterOrders,
      Math.max(topK * 3, topK),
    );

    if (eventRows.length === 0) {
      return [];
    }

    const rankedRows = eventRows
      .map((row) => ({
        row,
        chapterScore: chapterScoreMap.get(row.event.chapterOrder) ?? 0,
      }))
      .sort((left, right) => {
        if (right.chapterScore !== left.chapterScore) {
          return right.chapterScore - left.chapterScore;
        }
        if (left.row.event.chapterOrder !== right.row.event.chapterOrder) {
          return left.row.event.chapterOrder - right.row.event.chapterOrder;
        }
        return left.row.event.sequenceNo - right.row.event.sequenceNo;
      });

    const deduped: TimelineEvent[] = [];
    const seenEventIds = new Set<string>();
    for (const item of rankedRows) {
      if (seenEventIds.has(item.row.event.id)) {
        continue;
      }
      seenEventIds.add(item.row.event.id);
      deduped.push({
        eventId: item.row.event.id,
        entityId: item.row.entityIds[0] ?? "unknown_entity",
        chapterNo: item.row.event.chapterOrder,
        title: item.row.event.title,
        description:
          item.row.event.summary?.trim() ||
          item.row.event.evidence?.trim() ||
          item.row.event.title,
        confidence: item.row.event.confidence,
        status: item.row.event.status,
      });
      if (deduped.length >= topK) {
        break;
      }
    }

    return deduped;
  }
}
