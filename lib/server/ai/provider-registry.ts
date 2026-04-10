export type ProviderFamily =
  | 'openai-compatible'
  | 'gemini-native'
  | 'claude-native'
  | 'custom-endpoint';

export interface ProviderProfile {
  id: string;
  label: string;
  family: ProviderFamily;
  endpoint: string;
  modelIds: string[];
}

const providerProfiles: ProviderProfile[] = [
  {
    id: 'openai-default',
    label: 'OpenAI-compatible',
    family: 'openai-compatible',
    endpoint: 'https://api.openai.local/v1',
    modelIds: ['gpt-4.1', 'gpt-4o-mini'],
  },
  {
    id: 'gemini-default',
    label: 'Gemini-native',
    family: 'gemini-native',
    endpoint: 'https://generativelanguage.googleapis.local',
    modelIds: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  },
  {
    id: 'claude-default',
    label: 'Claude-native',
    family: 'claude-native',
    endpoint: 'https://api.anthropic.local/v1',
    modelIds: ['claude-sonnet-4', 'claude-haiku-4'],
  },
  {
    id: 'custom-default',
    label: 'Custom endpoint',
    family: 'custom-endpoint',
    endpoint: 'http://localhost:11434/v1',
    modelIds: ['custom-model'],
  },
];

export function listProviderProfiles(): ProviderProfile[] {
  return providerProfiles;
}

export function findProviderProfile(profileId: string): ProviderProfile {
  const profile = providerProfiles.find((entry) => entry.id === profileId);

  if (!profile) {
    throw new Error(`Unknown AI provider profile: ${profileId}`);
  }

  return profile;
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
