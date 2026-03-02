import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import { embedTexts, embeddingDimensions } from "@/core/retrieval/embedding";

type EmbedRequest = {
  projectId?: string;
  embeddingPresetId?: string;
  texts: string[];
  override?: {
    baseURL?: string;
    modelId?: string;
    thinkingBudget?: unknown;
  };
};

function validateEmbedRequest(payload: unknown): EmbedRequest | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.texts) || record.texts.length === 0) {
    return null;
  }

  const texts: string[] = [];
  for (const item of record.texts) {
    if (typeof item !== "string") {
      return null;
    }
    texts.push(item);
  }

  return {
    projectId: typeof record.projectId === "string" ? record.projectId : undefined,
    embeddingPresetId:
      typeof record.embeddingPresetId === "string" ? record.embeddingPresetId : undefined,
    texts,
    override:
      record.override && typeof record.override === "object"
        ? (record.override as EmbedRequest["override"])
        : undefined,
  };
}

export async function POST(request: Request) {
  try {
    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const input = validateEmbedRequest(bodyResult.data);
    if (!input) {
      return fail("INVALID_INPUT", "texts must be a non-empty string array", 400);
    }

    const vectors = embedTexts(input.texts);
    return ok({
      dimensions: embeddingDimensions(),
      vectors,
    });
  } catch (error) {
    return internalError(error);
  }
}
