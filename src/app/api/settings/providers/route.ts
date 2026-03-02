import { internalError, fail, ok, parseJsonBody } from "@/lib/http/api-response";
import { validateCreateProviderInput } from "@/lib/http/settings-validators";
import { LlmProvidersRepository } from "@/repositories/llm-providers-repository";
import { SecretStoreRepository } from "@/repositories/secret-store-repository";

const providersRepository = new LlmProvidersRepository();
const secretStoreRepository = new SecretStoreRepository();

function mapProvider(record: ReturnType<LlmProvidersRepository["list"]>[number]) {
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

export async function GET() {
  try {
    const rows = providersRepository.list();
    return ok(rows.map(mapProvider));
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

    const validation = validateCreateProviderInput(bodyResult.data);
    if (!validation.ok) {
      return fail(validation.code, validation.message, 400, validation.details);
    }

    let apiKeyRef: string | null = null;
    if (validation.data.apiKey) {
      const secret = secretStoreRepository.createSecret(validation.data.apiKey, 1);
      apiKeyRef = secret.id;
    }

    const created = providersRepository.upsert({
      id: crypto.randomUUID(),
      name: validation.data.name,
      protocol: validation.data.protocol,
      category: validation.data.category,
      baseUrl: validation.data.baseURL,
      apiKeyRef,
      enabled: validation.data.enabled ?? true,
      isBuiltin: false,
      builtinCode: null,
    });

    const stored = providersRepository.findById(created.id);
    if (!stored) {
      return fail("CREATE_FAILED", "failed to create provider", 500);
    }

    return ok(mapProvider(stored), 201);
  } catch (error) {
    return internalError(error);
  }
}
