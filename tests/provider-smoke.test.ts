import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentService } from '../lib/server/ai/agent-service.ts';
import { getModelFromProfile } from '../lib/server/ai/pi-transport-adapter.ts';

type SmokeCase = {
  family: 'openai-compatible' | 'openai-responses' | 'claude-native' | 'gemini-native';
  endpoint: string;
  modelId: string;
  api: string;
  authStyle: 'bearer' | 'api-key' | 'custom';
};

function assertFamilySmoke({ family, endpoint, modelId, api, authStyle }: SmokeCase) {
  const profile = {
    id: `${family}-profile`,
    label: `${family} smoke profile`,
    family,
    endpoint,
    apiKey: 'test-key',
    modelIds: [modelId],
    enabled: true,
  };

  const { model, family: resolvedFamily, apiKey, authStyle: resolvedAuthStyle } =
    getModelFromProfile(profile);

  assert.equal(resolvedFamily, family);
  assert.equal(apiKey, 'test-key');
  assert.equal(resolvedAuthStyle, authStyle);
  assert.equal(model.id, modelId);
  assert.equal(model.api, api);

  const service = new AgentService({ model });
  const state = service.getState();

  assert.equal(state.model.id, modelId);
  assert.equal(state.model.api, api);
  assert.equal(state.status, 'idle');
  assert.equal(state.isStreaming, false);
}

test('openai-compatible family smoke test', () => {
  assertFamilySmoke({
    family: 'openai-compatible',
    endpoint: 'https://example.invalid/openai-compatible/',
    modelId: 'gpt-4o-mini',
    api: 'openai-completions',
    authStyle: 'bearer',
  });
});

test('openai-responses family smoke test', () => {
  assertFamilySmoke({
    family: 'openai-responses',
    endpoint: 'https://example.invalid/openai-responses/',
    modelId: 'gpt-4.1-mini',
    api: 'openai-responses',
    authStyle: 'bearer',
  });
});

test('claude-native family smoke test', () => {
  assertFamilySmoke({
    family: 'claude-native',
    endpoint: 'https://example.invalid/claude-native/',
    modelId: 'claude-sonnet-4-20250514',
    api: 'anthropic-messages',
    authStyle: 'api-key',
  });
});

test('gemini-native family smoke test', () => {
  assertFamilySmoke({
    family: 'gemini-native',
    endpoint: 'https://example.invalid/gemini-native/',
    modelId: 'gemini-2.5-pro',
    api: 'google-generative-ai',
    authStyle: 'custom',
  });
});
