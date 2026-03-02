export type RetrievalIntent = "fact" | "relation" | "creative";

export type ChapterScope = {
  from?: number;
  to?: number;
};

export type RetrievalQueryInput = {
  projectId: string;
  query: string;
  chapterScope?: ChapterScope;
  topK?: number;
  strategy?: "auto" | "vector_first" | "alias_first";
};

export type EvidenceHit = {
  chapterNo: number;
  chapterId: string;
  chunkId: string;
  score: number;
  snippet: string;
  chunkType: "content" | "summary" | "event" | "lore";
  source: "vector" | "alias";
};

export type TimelineEvent = {
  eventId: string;
  entityId: string;
  chapterNo: number;
  title: string;
  description: string;
  confidence: number;
  status: "auto" | "confirmed" | "rejected";
};

export type RagAnswer = {
  answer: string;
  usedGraphRag: boolean;
  hits: EvidenceHit[];
  events: TimelineEvent[];
  intent: RetrievalIntent;
};

export type ReindexSummary = {
  indexedChapters: number;
  indexedChunks: number;
  lastBuildAt: string;
};
