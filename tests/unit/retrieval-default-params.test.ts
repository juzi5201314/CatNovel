import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_FINE_CHUNK_OVERLAP,
  DEFAULT_FINE_CHUNK_SIZE,
  DEFAULT_SUMMARY_CHUNK_SIZE,
  DEFAULT_TOP_K,
  DEFAULT_VECTOR_CANDIDATES,
  RERANK_WEIGHTS,
  RETRIEVAL_DEFAULTS,
} from "../../src/core/retrieval/default-params.ts";

test("retrieval defaults keep chunk and recall parameters aligned", () => {
  assert.equal(RETRIEVAL_DEFAULTS.fineChunkSize, DEFAULT_FINE_CHUNK_SIZE);
  assert.equal(RETRIEVAL_DEFAULTS.fineChunkOverlap, DEFAULT_FINE_CHUNK_OVERLAP);
  assert.equal(RETRIEVAL_DEFAULTS.summaryChunkSize, DEFAULT_SUMMARY_CHUNK_SIZE);
  assert.equal(RETRIEVAL_DEFAULTS.topK, DEFAULT_TOP_K);
  assert.equal(RETRIEVAL_DEFAULTS.vectorCandidates, DEFAULT_VECTOR_CANDIDATES);
});

test("rerank weights sum to one", () => {
  const totalWeight =
    RERANK_WEIGHTS.semantic +
    RERANK_WEIGHTS.chapterDistance +
    RERANK_WEIGHTS.aliasBoost;

  assert.equal(Number(totalWeight.toFixed(6)), 1);
});
