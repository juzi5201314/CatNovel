import type { EvidenceHit, RagAnswer, RetrievalIntent, TimelineEvent } from "./contracts";

type AssembleInput = {
  query: string;
  intent: RetrievalIntent;
  hits: EvidenceHit[];
  events?: TimelineEvent[];
  usedGraphRag?: boolean;
};

function buildAnswerText(input: AssembleInput): string {
  if (input.hits.length === 0) {
    return `未检索到与「${input.query}」相关的证据，请尝试缩小章节范围或补充关键词。`;
  }

  const bestHit = input.hits[0];
  const intentPrefix =
    input.intent === "creative"
      ? "创作建议"
      : input.intent === "relation"
        ? "关系检索结果"
        : "事实检索结果";

  return `${intentPrefix}：优先证据来自第 ${bestHit.chapterNo} 章（${bestHit.chunkId}），可据此继续回答。`;
}

export function assembleRagAnswer(input: AssembleInput): RagAnswer {
  return {
    answer: buildAnswerText(input),
    usedGraphRag: input.usedGraphRag ?? false,
    hits: input.hits,
    events: input.events ?? [],
    intent: input.intent,
  };
}
