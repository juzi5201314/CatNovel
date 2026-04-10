import {
  listModelsByProvider,
  listProviderProfiles,
} from '../../../../lib/server/ai/provider-registry';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId');

  if (profileId) {
    return Response.json({
      profileId,
      models: listModelsByProvider(profileId),
    });
  }

  return Response.json({
    providers: listProviderProfiles(),
  });
}
