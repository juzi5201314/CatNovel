export type EvidenceHit = {
  chapterNo: number;
  chapterId: string;
  chunkId: string;
  score: number;
  snippet: string;
};

export type TimelineEventHit = {
  eventId: string;
  entityId: string;
  chapterNo: number;
  title: string;
  description: string;
  confidence: number;
  status: "auto" | "confirmed" | "rejected" | "pending_review";
};

export type ContextUsedPayload = {
  usedGraphRag: boolean;
  hits: EvidenceHit[];
  events: TimelineEventHit[];
};

export type ContextToolCall = {
  toolName: "rag.search";
  status: "executed";
  args: {
    projectId: string;
    chapterId?: string;
    query: string;
    topK: number;
  };
};

export type ContextToolInput = {
  projectId: string;
  chapterId?: string;
  query: string;
  topK?: number;
};

export async function resolveContext(
  input: ContextToolInput,
): Promise<{ toolCall: ContextToolCall; contextUsed: ContextUsedPayload }> {
  const topK = input.topK ?? 6;
  const chapterNo = Number.parseInt(input.chapterId?.replace(/\D/g, "") ?? "1", 10) || 1;

  const hits: EvidenceHit[] = [
    {
      chapterNo,
      chapterId: input.chapterId ?? "c1",
      chunkId: `chunk_${chapterNo}_1`,
      score: 0.91,
      snippet: input.query.slice(0, 120),
    },
  ];

  return {
    toolCall: {
      toolName: "rag.search",
      status: "executed",
      args: {
        projectId: input.projectId,
        chapterId: input.chapterId,
        query: input.query,
        topK,
      },
    },
    contextUsed: {
      usedGraphRag: false,
      hits,
      events: [],
    },
  };
}
