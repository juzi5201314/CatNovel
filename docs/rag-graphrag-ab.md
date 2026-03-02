# W6 GraphRAG A/B 决策记录

## 1. 目标

验证 `GraphRAG` 在“关系型问题”上的收益，并确定是否启用：

- 召回是否提升或至少不退化
- 噪声是否下降
- 延迟是否可接受
- 回退机制是否生效

## 2. 实验设计

### 2.1 样本集

使用 `scripts/w6-graphrag-ab.mjs` 内置的 4 条关系查询集：

1. 沈见和林祁是什么关系（期望章节 2）
2. 周岚和沈见最后是什么关系（期望章节 3）
3. 顾砚和许策之间是什么关系（期望章节 4）
4. 周岚为什么会和林祁合作（期望章节 5）

### 2.2 对照组与实验组

- Baseline（A）：`/api/rag/query` + `strategy=vector_first`
- GraphRAG（B）：`/api/rag/relation` + `strategy=auto`

### 2.3 指标

- `recallAtK`：TopK 内是否命中期望章节
- `avgNoiseRatio`：`score < 0.55` 的命中占比（越低越好）
- `usedGraphRagRate`：请求中真正使用 GraphRAG 的比例
- `p95LatencyMs`：95 分位延迟

## 3. 运行命令

```bash
pnpm build
pnpm start --port 3000
node scripts/w6-graphrag-ab.mjs
```

## 4. 实验结果（2026-03-02）

脚本输出：

```json
{
  "k": 5,
  "noiseScoreThreshold": 0.55,
  "baseline": {
    "sampleSize": 4,
    "recallAtK": 1,
    "avgNoiseRatio": 0.95,
    "usedGraphRagRate": 0,
    "p95LatencyMs": 5,
    "failureRate": 0
  },
  "graphRag": {
    "sampleSize": 4,
    "recallAtK": 1,
    "avgNoiseRatio": 0.3,
    "usedGraphRagRate": 0.75,
    "p95LatencyMs": 9,
    "failureRate": 0
  },
  "deltas": {
    "recallAtK": 0,
    "avgNoiseRatio": -0.65,
    "p95LatencyMs": 4
  }
}
```

## 5. 决策

结论：**启用“仅关系问题触发 GraphRAG + 噪声阈值回退”**。

理由：

- `recallAtK` 无退化（1.00 -> 1.00）
- `avgNoiseRatio` 显著下降（0.95 -> 0.30）
- 延迟增加约 `+4ms`（可接受）
- `usedGraphRagRate=0.75`，说明存在自动回退场景，回退机制有效

## 6. 推荐默认配置

环境变量（已在实现中支持）：

- `RAG_GRAPH_ENABLED=true`
- `RAG_GRAPH_RELATION_ONLY=true`
- `RAG_GRAPH_FALLBACK_TO_VECTOR=true`
- `RAG_GRAPH_EDGE_THRESHOLD=0.7`
- `RAG_GRAPH_RANDOM_WALK_STEPS=120`
- `RAG_GRAPH_RESTART_PROB=0.18`
- `RAG_GRAPH_NOISE_SCORE_THRESHOLD=0.55`
- `RAG_GRAPH_NOISE_MAX_RATIO=0.45`

