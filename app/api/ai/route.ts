import { buildContextPacket } from '../../../lib/server/ai/context-engine.ts';
import {
  createProviderProfile,
  deleteProviderProfile,
  listProviderProfiles,
  resetProviderProfilesForTests,
  updateProviderProfile,
} from '../../../lib/server/ai/provider-registry.ts';
import {
  resetTokenUsageArchiveForTests,
} from '../../../lib/server/ai/token-usage-archive.ts';
import { defaultTestProfiles } from '../../../tests/helpers/db-test-utils.ts';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
} as const;

export async function GET(_request: Request) {
  void _request;
  return Response.json({
    profiles: listProviderProfiles(),
  }, {
    headers: noStoreHeaders,
  });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const action = payload.action;

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
    // 仅在测试环境允许重置，防止生产环境数据丢失
    if (process.env.NODE_ENV !== 'test' && process.env.CATNOVEL_ALLOW_TEST_RESET !== 'true') {
      return Response.json(
        { error: 'Test reset is not allowed in production environment' },
        { status: 403 }
      );
    }
    resetProviderProfilesForTests(defaultTestProfiles);
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

  return Response.json(
    { error: `Unknown action: ${action ?? 'undefined'}` },
    { status: 400 },
  );
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
