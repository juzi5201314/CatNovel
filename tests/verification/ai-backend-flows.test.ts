import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import {
  DELETE,
  GET,
  PATCH,
  POST,
} from '../../app/api/ai/route.ts';
import { GET as getModelRoute } from '../../app/api/ai/models/route.ts';
import { closeDatabase } from '../../db/client.ts';

function setupMemoryDatabase() {
  closeDatabase();
  process.env.CATNOVEL_DB_MEMORY = 'true';
  delete process.env.CATNOVEL_DATA_DIR;
  delete process.env.CATNOVEL_DB_FILE;
}

describe('AI backend flows', () => {
  before(() => {
    setupMemoryDatabase();
  });

  after(() => {
    closeDatabase();
  });

  beforeEach(async () => {
    await POST(
      new Request('http://localhost/api/ai', {
        method: 'POST',
        body: JSON.stringify({ action: 'reset-test-state' }),
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  test('provider profile CRUD works through the AI route', async () => {
    const createdResponse = await POST(
      new Request('http://localhost/api/ai', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-profile',
          label: 'Local custom provider',
          family: 'openai-compatible',
          endpoint: 'http://localhost:8080/v1',
          apiKey: 'custom-key',
          modelIds: ['story-model'],
        }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    assert.equal(createdResponse.status, 201);
    const createdPayload = await createdResponse.json();
    assert.equal(createdPayload.profile.label, 'Local custom provider');

    const updatedResponse = await PATCH(
      new Request('http://localhost/api/ai', {
        method: 'PATCH',
        body: JSON.stringify({
          profileId: createdPayload.profile.id,
          label: 'Updated local provider',
          modelIds: ['story-model', 'ghost-model'],
        }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    const updatedPayload = await updatedResponse.json();
    assert.equal(updatedPayload.profile.label, 'Updated local provider');
    assert.ok(updatedPayload.profile.modelIds.includes('ghost-model'));

    const profilesResponse = await GET(
      new Request('http://localhost/api/ai'),
    );
    const profilesPayload = await profilesResponse.json();
    assert.equal(
      profilesPayload.profiles.some(
        (profile: { id: string }) => profile.id === createdPayload.profile.id,
      ),
      true,
    );

    const deleteResponse = await DELETE(
      new Request(
        `http://localhost/api/ai?profileId=${createdPayload.profile.id}`,
        { method: 'DELETE' },
      ),
    );

    assert.equal(deleteResponse.status, 200);
    const deletedPayload = await deleteResponse.json();
    assert.equal(deletedPayload.removedProfile.id, createdPayload.profile.id);
  });

  test('context preview builds correct context packet', async () => {
    const contextPreviewResponse = await POST(
      new Request('http://localhost/api/ai', {
        method: 'POST',
        body: JSON.stringify({
          action: 'preview-context',
          chapter: '第一章：雨夜',
          settings: ['角色：阿澈'],
          summaries: ['此前主角刚离开旧城'],
          manualSelections: ['强调悬疑氛围'],
        }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    const contextPreviewPayload = await contextPreviewResponse.json();
    assert.equal(contextPreviewPayload.contextPacket.settingsCount, 1);
    assert.equal(contextPreviewPayload.contextPacket.summaryCount, 1);
    assert.equal(contextPreviewPayload.contextPacket.manualSelectionCount, 1);
    assert.match(
      contextPreviewPayload.contextPacket.combinedContext,
      /强调悬疑氛围/,
    );
  });

  test('model discovery covers OpenAI/Gemini/Claude/custom provider families', async () => {
    const families = [
      'openai-compatible',
      'gemini-native',
      'claude-native',
    ] as const;

    for (const family of families) {
      const response = await getModelRoute(
        new Request(`http://localhost/api/ai/models?family=${family}`),
      );

      const payload = await response.json();
      assert.equal(payload.family, family);
      assert.ok(payload.models.length > 0);
    }
  });
});
