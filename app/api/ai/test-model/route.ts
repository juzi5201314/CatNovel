import { findProviderProfile, type ProviderFamily } from '../../../../lib/server/ai/provider-registry.ts';

export async function POST(request: Request) {
  const payload = await request.json();
  const { profileId, modelId } = payload as {
    profileId?: string;
    modelId?: string;
  };

  if (!profileId || !modelId) {
    return Response.json(
      { success: false, error: 'profileId and modelId are required' },
      { status: 400 },
    );
  }

  let profile;
  try {
    profile = findProviderProfile(profileId);
  } catch {
    return Response.json(
      { success: false, error: 'Provider profile not found' },
      { status: 404 },
    );
  }

  if (!profile.apiKey.trim()) {
    return Response.json(
      { success: false, error: 'API key is not configured for this provider' },
      { status: 400 },
    );
  }

  const start = Date.now();

  try {
    const responseText = await testModelConnection(
      profile.family,
      profile.endpoint,
      profile.apiKey,
      modelId,
    );
    const latencyMs = Date.now() - start;

    return Response.json({
      success: true,
      responseText,
      latencyMs,
    });
  } catch (error) {
    const latencyMs = Date.now() - start;
    const message = error instanceof Error ? error.message : 'Connection test failed';

    return Response.json({
      success: false,
      error: message,
      latencyMs,
    });
  }
}

async function testModelConnection(
  family: ProviderFamily,
  endpoint: string,
  apiKey: string,
  modelId: string,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const base = endpoint.replace(/\/+$/, '');

    switch (family) {
      case 'openai-compatible':
      case 'custom-endpoint': {
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 10,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content ?? '';
        return content.slice(0, 100);
      }

      case 'openai-responses': {
        const res = await fetch(`${base}/responses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelId,
            input: 'hi',
            max_output_tokens: 10,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }

        const data = await res.json();
        const content = data.output?.[0]?.content?.[0]?.text ?? data.text ?? '';
        return content.slice(0, 100);
      }

      case 'claude-native': {
        const res = await fetch(`${base}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 10,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }

        const data = await res.json();
        const content = data.content?.[0]?.text ?? '';
        return content.slice(0, 100);
      }

      case 'gemini-native': {
        const res = await fetch(
          `${base}/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'hi' }] }],
              generationConfig: { maxOutputTokens: 10 },
            }),
            signal: controller.signal,
          },
        );

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }

        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        return content.slice(0, 100);
      }

      default:
        throw new Error(`Unsupported provider family: ${family}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
