import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import { validateRotateKeyInput } from "@/lib/http/settings-validators";
import { LlmProvidersRepository } from "@/repositories/llm-providers-repository";
import { SecretStoreRepository } from "@/repositories/secret-store-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const providersRepository = new LlmProvidersRepository();
const secretStoreRepository = new SecretStoreRepository();

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const provider = providersRepository.findById(id);
    if (!provider) {
      return fail("NOT_FOUND", "provider not found", 404);
    }

    const bodyResult = await parseJsonBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const validation = validateRotateKeyInput(bodyResult.data);
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    let keyVersion = 1;
    let nextApiKeyRef = provider.apiKeyRef ?? null;

    if (provider.apiKeyRef) {
      const meta = secretStoreRepository.getSecretMeta(provider.apiKeyRef);
      if (meta) {
        keyVersion = meta.keyVersion + 1;
        const rotated = secretStoreRepository.rotateSecret(
          provider.apiKeyRef,
          validation.data.apiKey,
          keyVersion,
        );
        if (!rotated) {
          return fail("ROTATE_FAILED", "failed to rotate key", 500);
        }
      } else {
        const created = secretStoreRepository.createSecret(validation.data.apiKey, 1);
        keyVersion = created.keyVersion;
        nextApiKeyRef = created.id;
      }
    } else {
      const created = secretStoreRepository.createSecret(validation.data.apiKey, 1);
      keyVersion = created.keyVersion;
      nextApiKeyRef = created.id;
    }

    if (nextApiKeyRef !== provider.apiKeyRef) {
      providersRepository.upsert({
        id: provider.id,
        name: provider.name,
        protocol: provider.protocol,
        category: provider.category,
        baseUrl: provider.baseUrl,
        apiKeyRef: nextApiKeyRef,
        enabled: provider.enabled,
        isBuiltin: provider.isBuiltin,
        builtinCode: provider.builtinCode,
      });
    }

    return ok({ success: true, keyVersion });
  } catch (error) {
    return internalError(error);
  }
}
