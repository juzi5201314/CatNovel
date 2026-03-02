import assert from "node:assert/strict";
import test from "node:test";

import { assembleRagAnswer } from "../../src/core/retrieval/context-assembler.ts";

test("context assembler returns fallback text when no evidence is found", () => {
  const result = assembleRagAnswer({
    query: "主角第一次出场在第几章？",
    intent: "fact",
    hits: [],
  });

  assert.equal(result.intent, "fact");
  assert.equal(result.usedGraphRag, false);
  assert.equal(result.hits.length, 0);
  assert.match(result.answer, /未检索到与「主角第一次出场在第几章？」相关的证据/);
});

test("context assembler keeps relation intent with graph rag marker", () => {
  const result = assembleRagAnswer({
    query: "A 和 B 的关系",
    intent: "relation",
    usedGraphRag: true,
    hits: [
      {
        chapterNo: 12,
        chapterId: "chapter_12",
        chunkId: "chapter_12:coarse:1",
        score: 0.89,
        snippet: "A 在宴会上称 B 为旧友。",
        chunkType: "summary",
        source: "vector",
      },
    ],
  });

  assert.equal(result.intent, "relation");
  assert.equal(result.usedGraphRag, true);
  assert.equal(result.hits[0].chapterNo, 12);
  assert.match(result.answer, /关系检索结果/);
});
