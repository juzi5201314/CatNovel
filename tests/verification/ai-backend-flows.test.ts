import { beforeEach, describe, expect, test } from 'bun:test';

import {
  DELETE,
  GET as getAiRoute,
  PATCH,
  POST,
} from '../../app/api/ai/route';
import { GET as getModelRoute } from '../../app/api/ai/models/route';

async function readStream(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) {
    return '';
  }

  let text = '';
  while (true) {
    const next = await reader.read();
    if (next.done) {
      break;
    }
    text +=
      typeof next.value === 'string'
        ? next.value
        : new TextDecoder().decode(next.value);
  }

  return text;
}

describe('AI backend flows', () => {
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
          family: 'custom-endpoint',
          endpoint: 'http://localhost:8080/v1',
          apiKey: 'custom-key',
          modelIds: ['story-model'],
        }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(createdResponse.status).toBe(201);
    const createdPayload = await createdResponse.json();
    expect(createdPayload.profile.label).toBe('Local custom provider');

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
    expect(updatedPayload.profile.label).toBe('Updated local provider');
    expect(updatedPayload.profile.modelIds).toContain('ghost-model');

    const profilesResponse = await getAiRoute(
      new Request('http://localhost/api/ai?resource=profiles'),
    );
    const profilesPayload = await profilesResponse.json();
    expect(
      profilesPayload.profiles.some(
        (profile: { id: string }) => profile.id === createdPayload.profile.id,
      ),
    ).toBe(true);

    const deleteResponse = await DELETE(
      new Request(
        `http://localhost/api/ai?profileId=${createdPayload.profile.id}`,
        { method: 'DELETE' },
      ),
    );

    expect(deleteResponse.status).toBe(200);
    const deletedPayload = await deleteResponse.json();
    expect(deletedPayload.removedProfile.id).toBe(createdPayload.profile.id);
  });

  test('model discovery covers OpenAI/Gemini/Claude/custom provider families', async () => {
    const families = [
      'openai-compatible',
      'gemini-native',
      'claude-native',
      'custom-endpoint',
    ] as const;

    for (const family of families) {
      const response = await getModelRoute(
        new Request(`http://localhost/api/ai/models?family=${family}`),
      );

      const payload = await response.json();
      expect(payload.family).toBe(family);
      expect(payload.models.length).toBeGreaterThan(0);
    }
  });

  test('streaming generation archives token usage and enriches context', async () => {
    const response = await POST(
      new Request('http://localhost/api/ai', {
        method: 'POST',
        body: JSON.stringify({
          action: 'generate',
          profileId: 'openai-default',
          modelId: 'gpt-4.1',
          taskClass: 'ghost-text',
          prompt: '续写这一段剧情',
          stream: true,
          chapter: '第一章：雨夜',
          settings: ['角色：阿澈'],
          summaries: ['此前主角刚离开旧城'],
          manualSelections: ['强调悬疑氛围'],
        }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const streamText = await readStream(response);
    expect(streamText).toContain('event: token');
    expect(streamText).toContain('event: done');
    expect(streamText).toContain('ghostText');

    const tokenUsageResponse = await getAiRoute(
      new Request('http://localhost/api/ai?resource=token-usage'),
    );
    const tokenUsagePayload = await tokenUsageResponse.json();
    expect(tokenUsagePayload.records.length).toBeGreaterThan(0);
    expect(tokenUsagePayload.records[0].taskClass).toBe('ghost-text');

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
    expect(contextPreviewPayload.contextPacket.settingsCount).toBe(1);
    expect(contextPreviewPayload.contextPacket.summaryCount).toBe(1);
    expect(contextPreviewPayload.contextPacket.manualSelectionCount).toBe(1);
    expect(contextPreviewPayload.contextPacket.combinedContext).toContain(
      '强调悬疑氛围',
    );
  });

  test('AI degraded paths return actionable server errors', async () => {
    const missingApiKeyProfile = await POST(
      new Request('http://localhost/api/ai', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-profile',
          label: 'Broken provider',
          family: 'custom-endpoint',
          endpoint: 'http://localhost:9090/v1',
          apiKey: '',
          modelIds: ['broken-model'],
        }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    const brokenProfilePayload = await missingApiKeyProfile.json();

    const generationFailureResponse = await POST(
      new Request('http://localhost/api/ai', {
        method: 'POST',
        body: JSON.stringify({
          action: 'generate',
          profileId: brokenProfilePayload.profile.id,
          modelId: 'broken-model',
          taskClass: '自由对话',
          prompt: '测试',
          chapter: '',
          settings: [],
          summaries: [],
          manualSelections: [],
          failMode: 'missing-api-key',
        }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(generationFailureResponse.status).toBe(400);
    const generationFailurePayload = await generationFailureResponse.json();
    expect(generationFailurePayload.error).toContain('Missing API key');

    const modelFailureResponse = await getModelRoute(
      new Request(
        'http://localhost/api/ai/models?failMode=model-list-fetch-failure',
      ),
    );

    expect(modelFailureResponse.status).toBe(502);
    const modelFailurePayload = await modelFailureResponse.json();
    expect(modelFailurePayload.error).toContain('Model list fetch failure');
  });
});
