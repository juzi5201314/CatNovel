import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import { validateCreateModelPresetInput } from "@/lib/http/settings-validators";
import { LlmModelPresetsRepository } from "@/repositories/llm-model-presets-repository";
import { LlmProvidersRepository } from "@/repositories/llm-providers-repository";

const modelPresetsRepository = new LlmModelPresetsRepository();
const providersRepository = new LlmProvidersRepository();

function mapThinkingBudget(record: ReturnType<LlmModelPresetsRepository["list"]>[number]) {
  if (record.thinkingBudgetType === "effort" && record.thinkingEffort) {
    return { type: "effort" as const, effort: record.thinkingEffort };
  }
  if (record.thinkingBudgetType === "tokens" && typeof record.thinkingTokens === "number") {
    return { type: "tokens" as const, tokens: record.thinkingTokens };
  }
  return undefined;
}

function mapPreset(record: ReturnType<LlmModelPresetsRepository["list"]>[number]) {
  return {
    id: record.id,
    providerId: record.providerId,
    purpose: record.purpose,
    chatApiFormat: record.chatApiFormat,
    modelId: record.modelId,
    customUserAgent: record.customUserAgent,
    temperature: record.temperature,
    maxTokens: record.maxTokens,
    thinkingBudget: mapThinkingBudget(record),
    isBuiltin: record.isBuiltin,
  };
}

export async function GET() {
  try {
    const rows = modelPresetsRepository.list();
    return ok(rows.map(mapPreset));
  } catch (error) {
    return internalError(error);
  }
}

export async function POST(request: Request) {
  try {
    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const validation = validateCreateModelPresetInput(bodyResult.data);
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    const provider = providersRepository.findById(validation.data.providerId);
    if (!provider) {
      return fail("INVALID_INPUT", "providerId does not exist", 400);
    }

    const created = modelPresetsRepository.upsert({
      id: crypto.randomUUID(),
      providerId: validation.data.providerId,
      purpose: validation.data.purpose,
      chatApiFormat: validation.data.chatApiFormat,
      modelId: validation.data.modelId,
      customUserAgent: validation.data.customUserAgent,
      temperature: validation.data.temperature,
      maxTokens: validation.data.maxTokens,
      thinkingBudgetType: validation.data.thinkingBudget?.type,
      thinkingEffort:
        validation.data.thinkingBudget?.type === "effort"
          ? validation.data.thinkingBudget.effort
          : undefined,
      thinkingTokens:
        validation.data.thinkingBudget?.type === "tokens"
          ? validation.data.thinkingBudget.tokens
          : undefined,
      isBuiltin: validation.data.isBuiltin ?? false,
    });

    const row = modelPresetsRepository.findById(created.id);
    if (!row) {
      return fail("CREATE_FAILED", "failed to create model preset", 500);
    }

    return ok(mapPreset(row), 201);
  } catch (error) {
    return internalError(error);
  }
}
