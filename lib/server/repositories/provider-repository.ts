import { randomUUID } from 'node:crypto';

import { getDatabase } from '../../../db/client.ts';
import type {
  ProviderFamily,
  ProviderProfileRecord,
} from '../../contracts/workspace.ts';

type ProviderRow = {
  id: string;
  workId: string;
  family: ProviderFamily;
  label: string;
  endpoint: string;
  model: string;
  modelIdsJson: string;
  apiKeyEnv: string;
  apiKey: string;
  enabled: number;
  createdAt: string;
  updatedAt: string;
};

const defaultProfiles: Array<{
  id: string;
  family: ProviderFamily;
  label: string;
  endpoint: string;
  model: string;
  modelIds: string[];
  apiKeyEnv: string;
  apiKey: string;
  enabled: boolean;
}> = [
  {
    id: 'openai-default',
    family: 'openai-compatible',
    label: 'OpenAI-compatible',
    endpoint: 'https://api.openai.local/v1',
    model: 'gpt-4.1',
    modelIds: ['gpt-4.1', 'gpt-4o-mini'],
    apiKeyEnv: 'OPENAI_API_KEY',
    apiKey: 'openai-test-key',
    enabled: true,
  },
  {
    id: 'gemini-default',
    family: 'gemini-native',
    label: 'Gemini-native',
    endpoint: 'https://generativelanguage.googleapis.local',
    model: 'gemini-2.5-pro',
    modelIds: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    apiKeyEnv: 'GEMINI_API_KEY',
    apiKey: 'gemini-test-key',
    enabled: true,
  },
  {
    id: 'claude-default',
    family: 'claude-native',
    label: 'Claude-native',
    endpoint: 'https://api.anthropic.local/v1',
    model: 'claude-sonnet-4',
    modelIds: ['claude-sonnet-4', 'claude-haiku-4'],
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    apiKey: 'claude-test-key',
    enabled: true,
  },
  {
    id: 'custom-default',
    family: 'custom-endpoint',
    label: 'Custom endpoint',
    endpoint: 'http://localhost:11434/v1',
    model: 'custom-model',
    modelIds: ['custom-model'],
    apiKeyEnv: 'CUSTOM_LLM_API_KEY',
    apiKey: 'custom-test-key',
    enabled: false,
  },
];

function hydrateProvider(row: ProviderRow): ProviderProfileRecord {
  const parsedModelIds = JSON.parse(row.modelIdsJson || '[]') as string[];

  return {
    id: row.id,
    workId: row.workId,
    family: row.family,
    label: row.label,
    endpoint: row.endpoint,
    model: row.model,
    modelIds: parsedModelIds.length > 0 ? parsedModelIds : [row.model],
    apiKeyEnv: row.apiKeyEnv,
    apiKey: row.apiKey,
    enabled: Boolean(row.enabled),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listProviderProfiles(workId = 'work-default') {
  const db = getDatabase();

  return db
    .prepare(
      `SELECT
        id,
        work_id AS workId,
        family,
        label,
        endpoint,
        model,
        model_ids_json AS modelIdsJson,
        api_key_env AS apiKeyEnv,
        api_key AS apiKey,
        enabled,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM ai_provider_profiles
      WHERE work_id = ?
      ORDER BY created_at ASC`,
    )
    .all(workId)
    .map((row) => hydrateProvider(row as ProviderRow));
}

export function getProviderProfile(profileId: string) {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT
        id,
        work_id AS workId,
        family,
        label,
        endpoint,
        model,
        model_ids_json AS modelIdsJson,
        api_key_env AS apiKeyEnv,
        api_key AS apiKey,
        enabled,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM ai_provider_profiles
      WHERE id = ?`,
    )
    .get(profileId) as ProviderRow | undefined;

  if (!row) {
    throw new Error(`Unknown AI provider profile: ${profileId}`);
  }

  return hydrateProvider(row);
}

export function createProviderProfile(input: {
  workId?: string;
  family: ProviderFamily;
  label: string;
  endpoint: string;
  apiKey: string;
  modelIds: string[];
  enabled?: boolean;
}) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = `provider-${randomUUID()}`;
  const modelIds = input.modelIds.map((entry) => entry.trim()).filter(Boolean);

  if (modelIds.length === 0) {
    throw new Error('At least one model id is required.');
  }

  db.prepare(
    `INSERT INTO ai_provider_profiles (
      id,
      work_id,
      family,
      label,
      endpoint,
      model,
      model_ids_json,
      api_key_env,
      api_key,
      enabled,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.workId ?? 'work-default',
    input.family,
    input.label,
    input.endpoint,
    modelIds[0],
    JSON.stringify(modelIds),
    `${input.label.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`,
    input.apiKey,
    input.enabled === false ? 0 : 1,
    now,
    now,
  );

  return getProviderProfile(id);
}

export function updateProviderProfile(
  profileId: string,
  updates: Partial<{
    family: ProviderFamily;
    label: string;
    endpoint: string;
    apiKey: string;
    modelIds: string[];
    enabled: boolean;
  }>,
) {
  const current = getProviderProfile(profileId);
  const modelIds =
    updates.modelIds?.map((entry) => entry.trim()).filter(Boolean) ?? current.modelIds;

  if (modelIds.length === 0) {
    throw new Error('At least one model id is required.');
  }

  const next = {
    ...current,
    ...(updates.family !== undefined ? { family: updates.family } : {}),
    ...(updates.label !== undefined ? { label: updates.label } : {}),
    ...(updates.endpoint !== undefined ? { endpoint: updates.endpoint } : {}),
    ...(updates.apiKey !== undefined ? { apiKey: updates.apiKey } : {}),
    ...(updates.enabled !== undefined ? { enabled: updates.enabled } : {}),
    modelIds,
    model: modelIds[0],
    updatedAt: new Date().toISOString(),
  };

  const db = getDatabase();
  db.prepare(
    `UPDATE ai_provider_profiles
       SET family = ?,
           label = ?,
           endpoint = ?,
           model = ?,
           model_ids_json = ?,
           api_key_env = ?,
           api_key = ?,
           enabled = ?,
           updated_at = ?
     WHERE id = ?`,
  ).run(
    next.family,
    next.label,
    next.endpoint,
    next.model,
    JSON.stringify(next.modelIds),
    next.apiKeyEnv,
    next.apiKey,
    next.enabled ? 1 : 0,
    next.updatedAt,
    profileId,
  );

  return getProviderProfile(profileId);
}

export function deleteProviderProfile(profileId: string) {
  const current = getProviderProfile(profileId);
  getDatabase().prepare('DELETE FROM ai_provider_profiles WHERE id = ?').run(profileId);
  return current;
}

export function resetProviderProfilesForTests(workId = 'work-default') {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM ai_provider_profiles WHERE work_id = ?').run(workId);

    const insert = db.prepare(
      `INSERT INTO ai_provider_profiles (
        id,
        work_id,
        family,
        label,
        endpoint,
        model,
        model_ids_json,
        api_key_env,
        api_key,
        enabled,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const profile of defaultProfiles) {
      insert.run(
        profile.id,
        workId,
        profile.family,
        profile.label,
        profile.endpoint,
        profile.model,
        JSON.stringify(profile.modelIds),
        profile.apiKeyEnv,
        profile.apiKey,
        profile.enabled ? 1 : 0,
        now,
        now,
      );
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
