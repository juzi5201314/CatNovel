import assert from 'node:assert/strict';
import test from 'node:test';

import { getModelFromProfile } from '../lib/server/ai/pi-transport-adapter.ts';
import type { ProviderProfile } from '../lib/server/ai/provider-registry.ts';

function createProfile(
  overrides: Partial<ProviderProfile>,
): ProviderProfile {
  return {
    id: 'profile-test',
    label: 'Test Provider',
    family: 'openai-compatible',
    endpoint: 'https://example.com/v1/',
    apiKey: 'test-key',
    modelIds: ['test-model'],
    enabled: true,
    ...overrides,
  };
}

test('maps openai-compatible profiles to pi-ai openai-completions models', () => {
  const result = getModelFromProfile(createProfile({
    family: 'openai-compatible',
    endpoint: 'https://compat.example.com/v1/',
    modelIds: ['gpt-4.1'],
  }));

  assert.equal(result.family, 'openai-compatible');
  assert.equal(result.authStyle, 'bearer');
  assert.equal(result.apiKey, 'test-key');
  assert.equal(result.model.api, 'openai-completions');
  assert.equal(result.model.id, 'gpt-4.1');
  assert.equal(result.model.baseUrl, 'https://compat.example.com/v1');
});

test('maps openai-responses profiles to pi-ai openai-responses models', () => {
  const result = getModelFromProfile(createProfile({
    family: 'openai-responses',
    endpoint: 'https://responses.example.com/v1/',
    modelIds: ['gpt-4.1-mini'],
  }));

  assert.equal(result.family, 'openai-responses');
  assert.equal(result.authStyle, 'bearer');
  assert.equal(result.model.api, 'openai-responses');
  assert.equal(result.model.id, 'gpt-4.1-mini');
  assert.equal(result.model.baseUrl, 'https://responses.example.com/v1');
});

test('maps claude-native profiles to pi-ai anthropic models', () => {
  const result = getModelFromProfile(createProfile({
    family: 'claude-native',
    endpoint: 'https://api.anthropic.example',
    modelIds: ['claude-sonnet-4'],
  }));

  assert.equal(result.family, 'claude-native');
  assert.equal(result.authStyle, 'api-key');
  assert.equal(result.model.api, 'anthropic-messages');
  assert.equal(result.model.id, 'claude-sonnet-4');
  assert.equal(result.model.baseUrl, 'https://api.anthropic.example');
});

test('maps gemini-native profiles to pi-ai google models', () => {
  const result = getModelFromProfile(createProfile({
    family: 'gemini-native',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/',
    modelIds: ['gemini-2.5-pro'],
  }));

  assert.equal(result.family, 'gemini-native');
  assert.equal(result.authStyle, 'custom');
  assert.equal(result.model.api, 'google-generative-ai');
  assert.equal(result.model.id, 'gemini-2.5-pro');
  assert.equal(result.model.baseUrl, 'https://generativelanguage.googleapis.com/v1beta');
});

test('throws a descriptive error when the API key is missing', () => {
  assert.throws(
    () => getModelFromProfile(createProfile({ apiKey: '   ' })),
    /missing an API key/i,
  );
});

test('throws a descriptive error for unsupported families', () => {
  assert.throws(
    () => getModelFromProfile(createProfile({ family: 'custom-endpoint' })),
    /unsupported provider family/i,
  );
});
