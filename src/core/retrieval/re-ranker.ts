import { RERANK_WEIGHTS } from "./default-params";

export type RankedCandidate = {
  chapterNo: number;
  chapterId: string;
  chunkId: string;
  snippet: string;
  chunkType: "content" | "summary" | "event" | "lore";
  semanticScore: number;
  aliasMatched: boolean;
  source: "vector" | "alias";
};

export type ReRankInput = {
  currentChapterNo?: number;
  candidates: RankedCandidate[];
};

function chapterDistanceScore(currentChapterNo: number | undefined, chapterNo: number): number {
  if (typeof currentChapterNo !== "number") {
    return 0.5;
  }
  return 1 / (1 + Math.abs(currentChapterNo - chapterNo));
}

export function reRankCandidates(input: ReRankInput): RankedCandidate[] {
  return [...input.candidates]
    .map((candidate) => {
      const distance = chapterDistanceScore(input.currentChapterNo, candidate.chapterNo);
      const aliasBoost = candidate.aliasMatched ? 1 : 0;
      const finalScore =
        candidate.semanticScore * RERANK_WEIGHTS.semantic +
        distance * RERANK_WEIGHTS.chapterDistance +
        aliasBoost * RERANK_WEIGHTS.aliasBoost;

      return {
        ...candidate,
        semanticScore: Number(finalScore.toFixed(6)),
      };
    })
    .sort((left, right) => right.semanticScore - left.semanticScore);
}
