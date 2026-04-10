import {
  listModelsByFamily,
  listModelsByProvider,
  listProviderProfiles,
  type ProviderFamily,
} from '../../../../lib/server/ai/provider-registry.ts';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId');
  const family = searchParams.get('family') as ProviderFamily | null;
  const failMode = searchParams.get('failMode');

  if (failMode === 'model-list-fetch-failure') {
    return Response.json(
      {
        error: 'Model list fetch failure',
      },
      { status: 502 },
    );
  }

  if (profileId) {
    return Response.json({
      profileId,
      models: listModelsByProvider(profileId),
    });
  }

  if (family) {
    return Response.json({
      family,
      models: listModelsByFamily(family),
    });
  }

  return Response.json({
    providers: listProviderProfiles(),
  });
}
