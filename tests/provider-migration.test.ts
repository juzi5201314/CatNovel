import assert from 'node:assert/strict';
import test from 'node:test';

import { PROVIDER_MATRIX } from '../lib/server/ai/provider-compatibility-matrix.ts';
import {
  isMigratedProfile,
  migrateProviderProfile,
  restoreProviderProfile,
} from '../lib/server/ai/provider-migration.ts';
import type { ProviderProfile } from '../lib/server/ai/provider-registry.ts';

test('covers all 25 preset providers in the compatibility matrix', () => {
  assert.equal(PROVIDER_MATRIX.length, 25);
});

test('round-trips every preset provider profile through pi models', () => {
  for (const provider of PROVIDER_MATRIX) {
    const profile = createProfile({
      id: `profile-${provider.key}`,
      label: provider.name,
      family: provider.family,
      endpoint: `${provider.baseUrl}/`,
      apiKey: `key-${provider.key}`,
      modelIds: [`model-${provider.key}`],
    });

    const model = migrateProviderProfile(profile);
    const restored = restoreProviderProfile(model);

    assert.equal(model.baseUrl, provider.baseUrl);
    assert.equal(restored.endpoint, `${provider.baseUrl}/`);
    assert.equal(restored.apiKey, `key-${provider.key}`);
    assert.deepEqual(restored, profile);
    assert.equal(isMigratedProfile(profile), true);
    assert.equal(isMigratedProfile(restored), true);
  }
});

test('treats custom-endpoint as an independent migration family', () => {
  const profile = createProfile({
    id: 'profile-custom-endpoint',
    label: 'My Local Gateway',
    family: 'custom-endpoint',
    endpoint: 'https://llm.internal.example/v1/',
    apiKey: 'local-secret',
    modelIds: ['qwen-local'],
  });

  const model = migrateProviderProfile(profile);
  const restored = restoreProviderProfile(model);

  assert.equal(model.api, 'openai-completions');
  assert.equal(model.provider, 'catnovel-custom-endpoint');
  assert.equal(model.baseUrl, 'https://llm.internal.example/v1');
  assert.deepEqual(restored, profile);
  assert.equal(restored.family, 'custom-endpoint');
});

test('throws when restoring a model without migration metadata', () => {
  assert.throws(
    () =>
      restoreProviderProfile({
        id: 'raw-model',
        name: 'raw-model',
        api: 'openai-completions',
        provider: 'raw-provider',
        baseUrl: 'https://example.com/v1',
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 0,
        maxTokens: 0,
      }),
    /not created by migrateProviderProfile/i,
  );
});

function createProfile(
  overrides: Partial<ProviderProfile>,
): ProviderProfile {
  return {
    id: 'profile-test',
    label: 'Test Provider',
    family: 'openai-compatible',
    endpoint: 'https://example.com/v1',
    apiKey: 'test-key',
    modelIds: ['test-model'],
    enabled: true,
    ...overrides,
  };
}
