import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import { embedTexts } from "@/core/retrieval/embedding";

type EmbedOverride = {
  baseURL?: string;
  modelId?: string;
  thinkingBudget?: unknown;
};

type EmbedRequest = {
  projectId?: string;
  embeddingPresetId?: string;
  texts: string[];
  override?: EmbedOverride;
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

  let override: EmbedOverride | undefined;
  if (record.override !== undefined) {
    if (!record.override || typeof record.override !== "object") {
      return null;
    }
    const overrideRecord = record.override as Record<string, unknown>;
    override = {
      baseURL:
        typeof overrideRecord.baseURL === "string" ? overrideRecord.baseURL : undefined,
      modelId:
        typeof overrideRecord.modelId === "string" ? overrideRecord.modelId : undefined,
      thinkingBudget: overrideRecord.thinkingBudget,
    };
  }

  return {
    projectId: typeof record.projectId === "string" ? record.projectId : undefined,
    embeddingPresetId:
      typeof record.embeddingPresetId === "string" ? record.embeddingPresetId : undefined,
    texts,
    override,
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

    const vectors = await embedTexts(input.texts, {
      projectId: input.projectId,
      embeddingPresetId: input.embeddingPresetId,
      override: input.override,
    });
    return ok({
      dimensions: vectors[0]?.length ?? 0,
      vectors,
    });
  } catch (error) {
    return internalError(error);
  }
}
