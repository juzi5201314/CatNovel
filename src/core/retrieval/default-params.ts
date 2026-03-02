export const DEFAULT_FINE_CHUNK_SIZE = 480;
export const DEFAULT_FINE_CHUNK_OVERLAP = 80;
export const DEFAULT_SUMMARY_CHUNK_SIZE = 360;
export const DEFAULT_TOP_K = 12;
export const DEFAULT_VECTOR_CANDIDATES = 32;

export const RERANK_WEIGHTS = {
  semantic: 0.7,
  chapterDistance: 0.2,
  aliasBoost: 0.1,
} as const;

export const RETRIEVAL_DEFAULTS = {
  fineChunkSize: DEFAULT_FINE_CHUNK_SIZE,
  fineChunkOverlap: DEFAULT_FINE_CHUNK_OVERLAP,
  summaryChunkSize: DEFAULT_SUMMARY_CHUNK_SIZE,
  topK: DEFAULT_TOP_K,
  vectorCandidates: DEFAULT_VECTOR_CANDIDATES,
} as const;
