import { getModel } from '@mariozechner/pi-ai';
import type { Api, Model, Provider } from '@mariozechner/pi-ai';

import type { ProviderProfile } from './provider-registry.ts';
import { PROVIDER_MATRIX } from './provider-compatibility-matrix.ts';
import { getModelFromProfile } from './pi-transport-adapter.ts';

type MigratedApi =
  | 'anthropic-messages'
  | 'google-generative-ai'
  | 'openai-completions'
  | 'openai-responses';

interface MigrationMetadata {
  profile: ProviderProfile;
  providerKey: string;
  migratedAt: number;
}

type MigratedModel = Model<MigratedApi> & {
  [migrationMetadataKey]?: MigrationMetadata;
};

export interface MigratedProvider {
  profile: ProviderProfile;
  model: Model<MigratedApi>;
  migratedAt: number;
  providerKey: string;
}

const customEndpointTemplate = getModel('openai', 'gpt-4o-mini');
const migrationMetadataKey = Symbol('catnovel.provider-migration');
const migratedProfiles = new Set<string>();
const migratedModels = new WeakMap<Model<Api>, MigrationMetadata>();

export function migrateProviderProfile(
  profile: ProviderProfile,
): Model<MigratedApi> {
  assertSupportedMigrationFamily(profile.family);

  const preservedProfile = cloneProfile(profile);
  const migratedAt = Date.now();
  const providerKey = resolveProviderKey(preservedProfile);
  const model =
    preservedProfile.family === 'custom-endpoint'
      ? createCustomEndpointModel(preservedProfile)
      : getModelFromProfile(preservedProfile).model;

  const metadata: MigrationMetadata = {
    profile: preservedProfile,
    providerKey,
    migratedAt,
  };

  migratedProfiles.add(profileSignature(preservedProfile));
  attachMetadata(model, metadata);

  return model;
}

export function restoreProviderProfile(model: Model<Api>): ProviderProfile {
  const metadata = readMetadata(model);

  if (!metadata) {
    throw new Error(
      'Cannot restore provider profile from a model that was not created by migrateProviderProfile().',
    );
  }

  const restoredProfile = cloneProfile(metadata.profile);
  migratedProfiles.add(profileSignature(restoredProfile));

  return restoredProfile;
}

export function isMigratedProfile(profile: ProviderProfile): boolean {
  return migratedProfiles.has(profileSignature(profile));
}

function createCustomEndpointModel(
  profile: ProviderProfile,
): Model<'openai-completions'> {
  return cloneModel(customEndpointTemplate, {
    id: resolveModelId(profile),
    name: resolveModelId(profile),
    api: 'openai-completions',
    provider: 'catnovel-custom-endpoint',
    baseUrl: normalizeEndpoint(profile.endpoint),
  });
}

function cloneModel<TApi extends MigratedApi>(
  template: Model<Api>,
  overrides: {
    id: string;
    name: string;
    api: TApi;
    provider: Provider;
    baseUrl: string;
  },
): Model<TApi> {
  return {
    ...template,
    ...overrides,
  } as Model<TApi>;
}

function attachMetadata(model: Model<MigratedApi>, metadata: MigrationMetadata) {
  migratedModels.set(model as Model<Api>, metadata);

  Object.defineProperty(model, migrationMetadataKey, {
    value: metadata,
    enumerable: false,
    configurable: false,
    writable: false,
  });
}

function readMetadata(model: Model<Api>): MigrationMetadata | undefined {
  return migratedModels.get(model) ?? (model as MigratedModel)[migrationMetadataKey];
}

function resolveProviderKey(profile: ProviderProfile): string {
  if (profile.family === 'custom-endpoint') {
    return 'custom-endpoint';
  }

  const normalizedEndpoint = normalizeEndpoint(profile.endpoint);
  const provider = PROVIDER_MATRIX.find(
    (entry) =>
      entry.family === profile.family &&
      normalizeEndpoint(entry.baseUrl) === normalizedEndpoint,
  );

  return provider?.key ?? 'custom-profile';
}

function resolveModelId(profile: ProviderProfile): string {
  const modelId = profile.modelIds[0]?.trim();

  if (!modelId) {
    throw new Error(`Provider profile "${profile.label}" does not have a model id.`);
  }

  return modelId;
}

function normalizeEndpoint(endpoint: string): string {
  const normalized = endpoint.trim().replace(/\/+$/, '');

  if (!normalized) {
    throw new Error('Provider endpoint is required.');
  }

  return normalized;
}

function cloneProfile(profile: ProviderProfile): ProviderProfile {
  return {
    ...profile,
    modelIds: [...profile.modelIds],
  };
}

function profileSignature(profile: ProviderProfile): string {
  return JSON.stringify({
    id: profile.id,
    label: profile.label,
    family: profile.family,
    endpoint: profile.endpoint,
    apiKey: profile.apiKey,
    modelIds: profile.modelIds,
    enabled: profile.enabled,
  });
}

function assertSupportedMigrationFamily(family: ProviderProfile['family']) {
  if (
    family === 'openai-compatible' ||
    family === 'openai-responses' ||
    family === 'claude-native' ||
    family === 'gemini-native' ||
    family === 'custom-endpoint'
  ) {
    return;
  }

  throw new Error(`Unsupported provider family for migration: ${family}`);
}
