import type { ActiveModelSelection, ProviderFamily } from '../../contracts/workspace.ts';
import {
  createProviderProfile as createProviderProfileRecord,
  deleteProviderProfile as deleteProviderProfileRecord,
  getProviderProfile,
  listProviderProfiles as listProviderProfileRecords,
  resetProviderProfilesForTests as resetProviderProfilesInDatabase,
  updateProviderProfile as updateProviderProfileRecord,
} from '../repositories/provider-repository.ts';
import { getPreference, setPreference } from '../repositories/preference-repository.ts';

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
  'openai-responses',
  'gemini-native',
  'claude-native',
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

export function getActiveModelPreference(workId = 'work-default'): ActiveModelSelection | null {
  const raw = getPreference('active_model');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ActiveModelSelection;
    if (parsed.profileId && parsed.modelId) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function setActiveModelPreference(selection: ActiveModelSelection, workId = 'work-default'): void {
  setPreference('active_model', JSON.stringify(selection));
}
