import { buildContextPacket } from '../../../lib/server/ai/context-engine.ts';
import {
  createGenerationStream,
  generateText,
} from '../../../lib/server/ai/generation-service.ts';
import {
  createProviderProfile,
  deleteProviderProfile,
  listProviderProfiles,
  resetProviderProfilesForTests,
  updateProviderProfile,
} from '../../../lib/server/ai/provider-registry.ts';
import {
  listTokenUsageRecords,
  resetTokenUsageArchiveForTests,
} from '../../../lib/server/ai/token-usage-archive.ts';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
} as const;

const sseHeaders = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache, no-transform',
} as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get('resource') ?? 'profiles';

  if (resource === 'token-usage') {
    return Response.json({
      records: listTokenUsageRecords(),
    }, {
      headers: noStoreHeaders,
    });
  }

  return Response.json({
    profiles: listProviderProfiles(),
  }, {
    headers: noStoreHeaders,
  });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const action = payload.action ?? 'generate';

  if (action === 'create-profile') {
    const profile = createProviderProfile({
      label: payload.label,
      family: payload.family,
      endpoint: payload.endpoint,
      apiKey: payload.apiKey ?? '',
      modelIds: payload.modelIds ?? [],
    });

    return Response.json(
      {
        profile,
      },
      { status: 201 },
    );
  }

  if (action === 'reset-test-state') {
    resetProviderProfilesForTests();
    resetTokenUsageArchiveForTests();

    return Response.json({
      ok: true,
    });
  }

  if (action === 'preview-context') {
    return Response.json({
      contextPacket: buildContextPacket({
        chapter: payload.chapter ?? '',
        settings: payload.settings ?? [],
        summaries: payload.summaries ?? [],
        manualSelections: payload.manualSelections ?? [],
      }),
    });
  }

  try {
    const result = generateText({
      profileId: payload.profileId ?? 'openai-default',
      modelId: payload.modelId ?? 'gpt-4.1',
      taskClass: payload.taskClass ?? '续写',
      prompt: payload.prompt ?? '',
      stream: payload.stream ?? false,
      failMode: payload.failMode,
      contextSelection: {
        chapter: payload.chapter ?? '',
        settings: payload.settings ?? [],
        summaries: payload.summaries ?? [],
        manualSelections: payload.manualSelections ?? [],
      },
    });

    if (payload.stream) {
      return new Response(createGenerationStream(result), {
        headers: sseHeaders,
      });
    }

    return Response.json({
      route: 'ai-generation',
      streamed: result.streamed,
      ghostText: result.ghostText,
      tokenUsage: result.tokenUsage,
      contextPacket: result.contextPacket,
      output: result.text,
      chunks: result.chunks,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Unknown AI backend error',
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const payload = await request.json();
  const profile = updateProviderProfile(payload.profileId, {
    label: payload.label,
    family: payload.family,
    endpoint: payload.endpoint,
    apiKey: payload.apiKey,
    modelIds: payload.modelIds,
    enabled: payload.enabled,
  });

  return Response.json({
    profile,
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId');

  if (!profileId) {
    return Response.json(
      {
        error: 'profileId is required',
      },
      { status: 400 },
    );
  }

  const removedProfile = deleteProviderProfile(profileId);
  return Response.json({
    removedProfile,
  });
}
