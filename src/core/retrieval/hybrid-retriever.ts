import { ChaptersRepository } from "@/repositories/chapters-repository";

import type { EvidenceHit, RagAnswer, RetrievalIntent, RetrievalQueryInput } from "./contracts";
import { assembleRagAnswer } from "./context-assembler";
import { DEFAULT_TOP_K, DEFAULT_VECTOR_CANDIDATES } from "./default-params";
import { embedText } from "./embedding";
import {
  readGraphRagRuntimeConfig,
  runGraphRagRuntimeQuery,
} from "./graph-rag-runtime";
import { reRankCandidates, type RankedCandidate } from "./re-ranker";
import { getProjectChunks } from "./runtime";

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

export class HybridRetriever {
  constructor(
    private readonly chapterRepository = new ChaptersRepository(),
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
    const fallbackHits = this.retrieveFallbackHits(input, topK);
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
        return assembleRagAnswer({
          query: input.query,
          intent,
          hits: graphResult.hits,
          events: [],
          usedGraphRag: true,
        });
      }

      if (!graphConfig.fallbackToVector && graphResult.executed) {
        return assembleRagAnswer({
          query: input.query,
          intent,
          hits: graphResult.hits,
          events: [],
          usedGraphRag: true,
        });
      }
    }

    return assembleRagAnswer({
      query: input.query,
      intent,
      hits: fallbackHits,
      events: [],
      usedGraphRag: false,
    });
  }

  private retrieveFallbackHits(input: RetrievalQueryInput, topK: number): EvidenceHit[] {
    const queryVector = embedText(input.query);
    const candidates: RankedCandidate[] = [];

    const allProjectChunks = getProjectChunks(input.projectId);
    const vectorHits = allProjectChunks
      .filter((item) => {
        if (
          input.chapterScope?.from !== undefined &&
          item.chapter_no < input.chapterScope.from
        ) {
          return false;
        }
        if (input.chapterScope?.to !== undefined && item.chapter_no > input.chapterScope.to) {
          return false;
        }
        return true;
      })
      .map((item) => {
        const dot = item.vector.reduce(
          (sum, value, index) => sum + value * (queryVector[index] ?? 0),
          0,
        );
        const similarity = Math.max(-1, Math.min(1, dot));
        return {
          ...item,
          _similarity: similarity,
        };
      })
      .sort((left, right) => right._similarity - left._similarity)
      .slice(0, DEFAULT_VECTOR_CANDIDATES)
      .map((item) => ({
        chapter_no: item.chapter_no,
        chapter_id: item.chapter_id,
        chunk_id: item.chunk_id,
        chunk_type: item.chunk_type,
        text: item.text,
        score: 1 - item._similarity,
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
}
