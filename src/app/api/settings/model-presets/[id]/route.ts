import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import { validatePatchModelPresetInput } from "@/lib/http/settings-validators";
import { LlmModelPresetsRepository } from "@/repositories/llm-model-presets-repository";
import { LlmProvidersRepository } from "@/repositories/llm-providers-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const modelPresetsRepository = new LlmModelPresetsRepository();
const providersRepository = new LlmProvidersRepository();

function mapThinkingBudget(record: NonNullable<ReturnType<LlmModelPresetsRepository["findById"]>>) {
  if (record.thinkingBudgetType === "effort" && record.thinkingEffort) {
    return { type: "effort" as const, effort: record.thinkingEffort };
  }
  if (record.thinkingBudgetType === "tokens" && typeof record.thinkingTokens === "number") {
    return { type: "tokens" as const, tokens: record.thinkingTokens };
  }
  return undefined;
}

function mapPreset(record: NonNullable<ReturnType<LlmModelPresetsRepository["findById"]>>) {
  return {
    id: record.id,
    providerId: record.providerId,
    purpose: record.purpose,
    apiFormat: record.apiFormat,
    modelId: record.modelId,
    temperature: record.temperature,
    maxTokens: record.maxTokens,
    thinkingBudget: mapThinkingBudget(record),
    isBuiltin: record.isBuiltin,
  };
}

function validatePurposeAndFormat(purpose: string, apiFormat: string) {
  if (purpose === "embedding" && apiFormat !== "embeddings") {
    return false;
  }
  if (purpose === "chat" && apiFormat === "embeddings") {
    return false;
  }
  return true;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const preset = modelPresetsRepository.findById(id);
    if (!preset) {
      return fail("NOT_FOUND", "model preset not found", 404);
    }
    return ok(mapPreset(preset));
  } catch (error) {
    return internalError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existing = modelPresetsRepository.findById(id);
    if (!existing) {
      return fail("NOT_FOUND", "model preset not found", 404);
    }

    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const validation = validatePatchModelPresetInput(bodyResult.data);
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    const providerId = validation.data.providerId ?? existing.providerId;
    const provider = providersRepository.findById(providerId);
    if (!provider) {
      return fail("INVALID_INPUT", "providerId does not exist", 400);
    }

    const purpose = validation.data.purpose ?? existing.purpose;
    const apiFormat = validation.data.apiFormat ?? existing.apiFormat;
    if (!validatePurposeAndFormat(purpose, apiFormat)) {
      return fail("INVALID_INPUT", "purpose and apiFormat are incompatible", 400);
    }

    modelPresetsRepository.upsert({
      id: existing.id,
      providerId,
      purpose,
      apiFormat,
      modelId: validation.data.modelId ?? existing.modelId,
      temperature: validation.data.temperature ?? existing.temperature ?? undefined,
      maxTokens: validation.data.maxTokens ?? existing.maxTokens ?? undefined,
      thinkingBudgetType:
        validation.data.thinkingBudget?.type ?? existing.thinkingBudgetType ?? undefined,
      thinkingEffort:
        validation.data.thinkingBudget?.type === "effort"
          ? validation.data.thinkingBudget.effort
          : validation.data.thinkingBudget?.type === "tokens"
            ? undefined
            : existing.thinkingEffort ?? undefined,
      thinkingTokens:
        validation.data.thinkingBudget?.type === "tokens"
          ? validation.data.thinkingBudget.tokens
          : validation.data.thinkingBudget?.type === "effort"
            ? undefined
            : existing.thinkingTokens ?? undefined,
      isBuiltin: existing.isBuiltin,
    });

    const updated = modelPresetsRepository.findById(existing.id);
    if (!updated) {
      return fail("UPDATE_FAILED", "failed to update model preset", 500);
    }

    return ok(mapPreset(updated));
  } catch (error) {
    return internalError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existing = modelPresetsRepository.findById(id);
    if (!existing) {
      return fail("NOT_FOUND", "model preset not found", 404);
    }

    const deleted = modelPresetsRepository.deleteById(id);
    if (!deleted) {
      return fail("DELETE_FAILED", "failed to delete model preset", 500);
    }

    return ok({ success: true });
  } catch (error) {
    return internalError(error);
  }
}
