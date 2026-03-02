import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import { validatePatchProviderInput } from "@/lib/http/settings-validators";
import { LlmProvidersRepository } from "@/repositories/llm-providers-repository";
import { SecretStoreRepository } from "@/repositories/secret-store-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const providersRepository = new LlmProvidersRepository();
const secretStoreRepository = new SecretStoreRepository();

function mapProvider(record: NonNullable<ReturnType<LlmProvidersRepository["findById"]>>) {
  return {
    id: record.id,
    name: record.name,
    protocol: record.protocol,
    category: record.category,
    baseURL: record.baseUrl,
    enabled: record.enabled,
    isBuiltin: record.isBuiltin,
    builtinCode: record.builtinCode,
    hasApiKey: Boolean(record.apiKeyRef),
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const provider = providersRepository.findById(id);
    if (!provider) {
      return fail("NOT_FOUND", "provider not found", 404);
    }
    return ok(mapProvider(provider));
  } catch (error) {
    return internalError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existing = providersRepository.findById(id);
    if (!existing) {
      return fail("NOT_FOUND", "provider not found", 404);
    }

    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const validation = validatePatchProviderInput(bodyResult.data);
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    if (
      existing.isBuiltin &&
      (validation.data.name !== undefined || validation.data.protocol !== undefined)
    ) {
      return fail(
        "BUILTIN_PROVIDER_LOCKED",
        "builtin provider does not allow changing name/protocol",
        409,
      );
    }

    let apiKeyRef = existing.apiKeyRef ?? null;
    if (validation.data.apiKey) {
      const secret = secretStoreRepository.createSecret(validation.data.apiKey, 1);
      apiKeyRef = secret.id;
    }

    providersRepository.upsert({
      id: existing.id,
      name: validation.data.name ?? existing.name,
      protocol: validation.data.protocol ?? existing.protocol,
      category: validation.data.category ?? existing.category,
      baseUrl: validation.data.baseURL ?? existing.baseUrl,
      apiKeyRef,
      enabled: validation.data.enabled ?? existing.enabled,
      isBuiltin: existing.isBuiltin,
      builtinCode: existing.builtinCode,
    });

    const updated = providersRepository.findById(existing.id);
    if (!updated) {
      return fail("UPDATE_FAILED", "failed to update provider", 500);
    }

    return ok(mapProvider(updated));
  } catch (error) {
    return internalError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existing = providersRepository.findById(id);
    if (!existing) {
      return fail("NOT_FOUND", "provider not found", 404);
    }

    if (existing.isBuiltin) {
      return fail("BUILTIN_PROVIDER_LOCKED", "builtin provider cannot be deleted", 409);
    }

    const deleted = providersRepository.deleteById(id);
    if (!deleted) {
      return fail("DELETE_FAILED", "failed to delete provider", 500);
    }

    return ok({ success: true });
  } catch (error) {
    return internalError(error);
  }
}
