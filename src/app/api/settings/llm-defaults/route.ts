import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import { validatePatchLlmDefaultsInput } from "@/lib/http/settings-validators";
import { LlmDefaultSelectionRepository } from "@/repositories/llm-default-selection-repository";
import { LlmModelPresetsRepository } from "@/repositories/llm-model-presets-repository";

const defaultSelectionRepository = new LlmDefaultSelectionRepository();
const modelPresetsRepository = new LlmModelPresetsRepository();

export async function PATCH(request: Request) {
  try {
    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const validation = validatePatchLlmDefaultsInput(bodyResult.data);
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    if (validation.data.defaultChatPresetId) {
      const chatPreset = modelPresetsRepository.findById(validation.data.defaultChatPresetId);
      if (!chatPreset) {
        return fail("INVALID_INPUT", "defaultChatPresetId does not exist", 400);
      }
      if (chatPreset.purpose !== "chat") {
        return fail("INVALID_INPUT", "defaultChatPresetId must be a chat preset", 400);
      }
    }

    if (validation.data.defaultEmbeddingPresetId) {
      const embeddingPreset = modelPresetsRepository.findById(
        validation.data.defaultEmbeddingPresetId,
      );
      if (!embeddingPreset) {
        return fail("INVALID_INPUT", "defaultEmbeddingPresetId does not exist", 400);
      }
      if (embeddingPreset.purpose !== "embedding") {
        return fail(
          "INVALID_INPUT",
          "defaultEmbeddingPresetId must be an embedding preset",
          400,
        );
      }
    }

    const result = defaultSelectionRepository.upsert({
      projectId: validation.data.projectId,
      defaultChatPresetId: validation.data.defaultChatPresetId,
      defaultEmbeddingPresetId: validation.data.defaultEmbeddingPresetId,
    });

    return ok({
      success: true,
      projectId: result.projectId,
      defaultChatPresetId: result.defaultChatPresetId,
      defaultEmbeddingPresetId: result.defaultEmbeddingPresetId,
    });
  } catch (error) {
    return internalError(error);
  }
}
