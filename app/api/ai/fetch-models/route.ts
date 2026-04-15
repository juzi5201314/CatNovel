import { findProviderProfile, type ProviderFamily } from '../../../../lib/server/ai/provider-registry.ts';

export async function POST(request: Request) {
  const payload = await request.json();
  const { profileId, family, endpoint, apiKey } = payload as {
    profileId?: string;
    family?: ProviderFamily;
    endpoint?: string;
    apiKey?: string;
  };

  let resolvedFamily = family;
  let resolvedEndpoint = endpoint;
  let resolvedApiKey = apiKey;

  if (profileId) {
    try {
      const profile = findProviderProfile(profileId);
      resolvedFamily = resolvedFamily ?? profile.family;
      resolvedEndpoint = resolvedEndpoint ?? profile.endpoint;
      resolvedApiKey = resolvedApiKey ?? profile.apiKey;
    } catch {
      return Response.json({ models: [], error: 'Provider profile not found' }, { status: 404 });
    }
  }

  if (!resolvedFamily || !resolvedEndpoint || !resolvedApiKey) {
    return Response.json({ models: [], error: 'family, endpoint, and apiKey are required' }, { status: 400 });
  }

  try {
    const models = await fetchModelsFromProvider(resolvedFamily, resolvedEndpoint, resolvedApiKey);
    return Response.json({ models });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch models';
    return Response.json({ models: [], error: message }, { status: 502 });
  }
}

async function fetchModelsFromProvider(
  family: ProviderFamily,
  endpoint: string,
  apiKey: string,
): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    switch (family) {
      case 'openai-compatible':
      case 'openai-responses':
      case 'custom-endpoint': {
        const res = await fetch(`${endpoint.replace(/\/+$/, '')}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (data.data ?? []).map((m: { id: string }) => m.id).filter(Boolean).sort();
      }

      case 'claude-native': {
        const base = endpoint.replace(/\/+$/, '');
        const res = await fetch(`${base}/v1/models`, {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (data.data ?? []).map((m: { id: string }) => m.id).filter(Boolean).sort();
      }

      case 'gemini-native': {
        const base = endpoint.replace(/\/+$/, '');
        const res = await fetch(`${base}/v1beta/models?key=${apiKey}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (data.models ?? [])
          .map((m: { name: string }) => m.name?.replace(/^models\//, ''))
          .filter(Boolean)
          .sort();
      }

      default:
        throw new Error(`Unsupported provider family: ${family}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
