import type { ProviderFamily } from '../../contracts/workspace.ts';
import {
  createProviderProfile as createProviderProfileRecord,
  deleteProviderProfile as deleteProviderProfileRecord,
  getProviderProfile,
  listProviderProfiles as listProviderProfileRecords,
  resetProviderProfilesForTests as resetProviderProfilesInDatabase,
  updateProviderProfile as updateProviderProfileRecord,
} from '../repositories/provider-repository.ts';

export type { ProviderFamily };

export interface ProviderProfileInput {
  label: string;
  family: ProviderFamily;
  endpoint: string;
  apiKey: string;
  modelIds: string[];
}

export interface ProviderProfile extends ProviderProfileInput {
  id: string;
  enabled: boolean;
}

export const supportedProviderFamilies: ProviderFamily[] = [
  'openai-compatible',
  'gemini-native',
  'claude-native',
  'custom-endpoint',
];

export function listProviderProfiles(): ProviderProfile[] {
  return listProviderProfileRecords().map((profile) => ({
    id: profile.id,
    label: profile.label,
    family: profile.family,
    endpoint: profile.endpoint,
    apiKey: profile.apiKey,
    modelIds: profile.modelIds,
    enabled: profile.enabled,
  }));
}

export function findProviderProfile(profileId: string): ProviderProfile {
  const profile = getProviderProfile(profileId);

  return {
    id: profile.id,
    label: profile.label,
    family: profile.family,
    endpoint: profile.endpoint,
    apiKey: profile.apiKey,
    modelIds: profile.modelIds,
    enabled: profile.enabled,
  };
}

export function createProviderProfile(input: ProviderProfileInput): ProviderProfile {
  const profile = createProviderProfileRecord(input);
  return findProviderProfile(profile.id);
}

export function updateProviderProfile(
  profileId: string,
  input: Partial<ProviderProfileInput>,
): ProviderProfile {
  updateProviderProfileRecord(profileId, input);
  return findProviderProfile(profileId);
}

export function deleteProviderProfile(profileId: string) {
  const current = deleteProviderProfileRecord(profileId);

  return {
    id: current.id,
    label: current.label,
    family: current.family,
    endpoint: current.endpoint,
    apiKey: current.apiKey,
    modelIds: current.modelIds,
    enabled: current.enabled,
  };
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
  if (!supportedProviderFamilies.includes(family)) {
    return [];
  }

  return listProviderProfiles()
    .filter((profile) => profile.family === family)
    .flatMap((profile) => listModelsByProvider(profile.id));
}

export function resetProviderProfilesForTests() {
  resetProviderProfilesInDatabase();
}
