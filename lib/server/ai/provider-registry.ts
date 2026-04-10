export type ProviderFamily =
  | 'openai-compatible'
  | 'gemini-native'
  | 'claude-native'
  | 'custom-endpoint';

export interface ProviderProfileInput {
  label: string;
  family: ProviderFamily;
  endpoint: string;
  apiKey: string;
  modelIds: string[];
}

export interface ProviderProfile extends ProviderProfileInput {
  id: string;
}

const defaultProviderProfiles: ProviderProfile[] = [
  {
    id: 'openai-default',
    label: 'OpenAI-compatible',
    family: 'openai-compatible',
    endpoint: 'https://api.openai.local/v1',
    apiKey: 'openai-test-key',
    modelIds: ['gpt-4.1', 'gpt-4o-mini'],
  },
  {
    id: 'gemini-default',
    label: 'Gemini-native',
    family: 'gemini-native',
    endpoint: 'https://generativelanguage.googleapis.local',
    apiKey: 'gemini-test-key',
    modelIds: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  },
  {
    id: 'claude-default',
    label: 'Claude-native',
    family: 'claude-native',
    endpoint: 'https://api.anthropic.local/v1',
    apiKey: 'claude-test-key',
    modelIds: ['claude-sonnet-4', 'claude-haiku-4'],
  },
  {
    id: 'custom-default',
    label: 'Custom endpoint',
    family: 'custom-endpoint',
    endpoint: 'http://localhost:11434/v1',
    apiKey: 'custom-test-key',
    modelIds: ['custom-model'],
  },
];

let providerProfiles = cloneProfiles(defaultProviderProfiles);
let nextProviderSequence = 1;

export function listProviderProfiles(): ProviderProfile[] {
  return cloneProfiles(providerProfiles);
}

export function findProviderProfile(profileId: string): ProviderProfile {
  const profile = providerProfiles.find((entry) => entry.id === profileId);

  if (!profile) {
    throw new Error(`Unknown AI provider profile: ${profileId}`);
  }

  return { ...profile, modelIds: [...profile.modelIds] };
}

export function createProviderProfile(
  input: ProviderProfileInput,
): ProviderProfile {
  assertProfileInput(input);

  const profile: ProviderProfile = {
    ...input,
    id: `provider-${nextProviderSequence++}`,
    modelIds: [...input.modelIds],
  };

  providerProfiles = [...providerProfiles, profile];
  return findProviderProfile(profile.id);
}

export function updateProviderProfile(
  profileId: string,
  input: Partial<ProviderProfileInput>,
): ProviderProfile {
  const current = findProviderProfile(profileId);
  const nextProfile: ProviderProfile = {
    ...current,
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.family !== undefined ? { family: input.family } : {}),
    ...(input.endpoint !== undefined ? { endpoint: input.endpoint } : {}),
    ...(input.apiKey !== undefined ? { apiKey: input.apiKey } : {}),
    ...(input.modelIds !== undefined ? { modelIds: [...input.modelIds] } : {}),
  };

  assertProfileInput({
    label: nextProfile.label,
    family: nextProfile.family,
    endpoint: nextProfile.endpoint,
    apiKey: nextProfile.apiKey,
    modelIds: nextProfile.modelIds,
  });

  providerProfiles = providerProfiles.map((entry) =>
    entry.id === profileId ? nextProfile : entry,
  );

  return findProviderProfile(profileId);
}

export function deleteProviderProfile(profileId: string) {
  const current = findProviderProfile(profileId);
  providerProfiles = providerProfiles.filter((entry) => entry.id !== profileId);
  return current;
}

export function listModelsByProvider(profileId: string) {
  const profile = findProviderProfile(profileId);

  return profile.modelIds.map((modelId) => ({
    id: modelId,
    profileId,
    family: profile.family,
    label: `${profile.label} / ${modelId}`,
  }));
}

export function listModelsByFamily(family: ProviderFamily) {
  return providerProfiles
    .filter((profile) => profile.family === family)
    .flatMap((profile) => listModelsByProvider(profile.id));
}

export function resetProviderProfilesForTests() {
  providerProfiles = cloneProfiles(defaultProviderProfiles);
  nextProviderSequence = 1;
}

function assertProfileInput(input: ProviderProfileInput) {
  if (!input.label.trim()) {
    throw new Error('Provider label is required.');
  }

  if (!input.endpoint.trim()) {
    throw new Error('Provider endpoint is required.');
  }

  if (!Array.isArray(input.modelIds) || input.modelIds.length === 0) {
    throw new Error('At least one model id is required.');
  }
}

function cloneProfiles(profiles: ProviderProfile[]) {
  return profiles.map((profile) => ({
    ...profile,
    modelIds: [...profile.modelIds],
  }));
}
