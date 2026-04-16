import assert from 'node:assert/strict';
import test from 'node:test';

import type { Agent } from '@mariozechner/pi-agent-core';
import { getModel } from '@mariozechner/pi-ai';

import { AgentService } from '../lib/server/ai/agent-service.ts';

test('creates an AgentService instance around pi-agent-core Agent', () => {
  const service = new AgentService({
    model: getModel('openai', 'gpt-4o-mini'),
    systemPrompt: 'You are a test assistant.',
  });

  const state = service.getState();

  assert.equal(state.model.id, 'gpt-4o-mini');
  assert.equal(state.systemPrompt, 'You are a test assistant.');
  assert.equal(state.status, 'idle');
  assert.equal(state.isStreaming, false);
});

test('injects context-engine output through transformContext', async () => {
  const service = new AgentService({
    model: getModel('openai', 'gpt-4o-mini'),
    contextSelection: {
      chapter: 'Chapter opening',
      settings: ['World note'],
      summaries: ['Previous scene'],
      manualSelections: ['Pinned reference'],
    },
  });

  const internalAgent = (service as unknown as { agent: Agent }).agent;
  const transformed = await internalAgent.transformContext?.([
    {
      role: 'user',
      content: 'Continue the story.',
      timestamp: Date.now(),
    },
  ]);

  assert.ok(transformed);
  assert.equal(transformed?.length, 2);

  const contextMessage = transformed?.[0];
  assert.ok(contextMessage);
  assert.equal(contextMessage?.role, 'user');

  if (contextMessage?.role !== 'user' || typeof contextMessage.content !== 'string') {
    assert.fail('Expected context transform to inject a string user message.');
  }

  assert.match(contextMessage.content, /Context engine:/);
  assert.match(contextMessage.content, /Chapter opening/);
  assert.match(contextMessage.content, /World note/);
  assert.match(contextMessage.content, /Previous scene/);
  assert.match(contextMessage.content, /Pinned reference/);
});
