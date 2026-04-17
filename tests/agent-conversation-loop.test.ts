import assert from 'node:assert/strict';
import test from 'node:test';

import type { AgentMessage } from '@mariozechner/pi-agent-core';
import { fauxAssistantMessage, registerFauxProvider } from '@mariozechner/pi-ai';

import { AgentService } from '../lib/server/ai/agent-service.ts';
import { closeDatabase } from '../db/client.ts';

function setupMemoryDatabase() {
  closeDatabase();
  process.env.CATNOVEL_DB_MEMORY = 'true';
  delete process.env.CATNOVEL_DATA_DIR;
  delete process.env.CATNOVEL_DB_FILE;
}

function createFauxRegistration(name: string) {
  const suffix = `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return registerFauxProvider({
    api: `faux-api-${suffix}`,
    provider: `faux-provider-${suffix}`,
    models: [{ id: `faux-model-${suffix}` }],
  });
}

function readUserText(message: AgentMessage | undefined): string {
  if (!message || message.role !== 'user') {
    assert.fail('Expected a user message.');
  }

  if (typeof message.content === 'string') {
    return message.content;
  }

  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

function readAssistantText(message: AgentMessage | undefined): string {
  if (!message || message.role !== 'assistant') {
    assert.fail('Expected an assistant message.');
  }

  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

test('accumulates transcript across multiple prompt turns', async () => {
  setupMemoryDatabase();

  const registration = createFauxRegistration('conversation-loop');

  try {
    registration.setResponses([
      fauxAssistantMessage('First assistant reply.'),
      fauxAssistantMessage('Second assistant reply.'),
    ]);

    const service = new AgentService({
      model: registration.getModel(),
      systemPrompt: 'You are a deterministic test assistant.',
    });

    await service.prompt('Hello');

    const firstTurnMessages = service.getMessages();

    assert.equal(firstTurnMessages.length, 2);
    assert.deepEqual(firstTurnMessages.map((message) => message.role), [
      'user',
      'assistant',
    ]);
    assert.equal(readUserText(firstTurnMessages[0]), 'Hello');
    assert.equal(readAssistantText(service.getFinalMessage()), 'First assistant reply.');
    assert.equal(service.getState().isStreaming, false);

    await service.prompt('Tell me more');

    const secondTurnMessages = service.getMessages();

    assert.equal(secondTurnMessages.length, 4);
    assert.deepEqual(secondTurnMessages.map((message) => message.role), [
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    assert.equal(readUserText(secondTurnMessages[2]), 'Tell me more');
    assert.equal(readAssistantText(service.getFinalMessage()), 'Second assistant reply.');
    assert.equal(service.getState().status, 'completed');
    assert.equal(service.getState().isStreaming, false);
    assert.equal(registration.state.callCount, 2);
  } finally {
    registration.unregister();
    closeDatabase();
  }
});

test('getMessages returns a snapshot and reset clears transcript for a new session', async () => {
  setupMemoryDatabase();

  const registration = createFauxRegistration('conversation-reset');

  try {
    registration.setResponses([fauxAssistantMessage('Before reset.')]);

    const service = new AgentService({
      model: registration.getModel(),
    });

    await service.prompt('First turn');

    const snapshot = service.getMessages();
    snapshot.pop();

    assert.equal(service.getMessages().length, 2);
    assert.equal(readAssistantText(service.getFinalMessage()), 'Before reset.');

    service.reset();

    assert.deepEqual(service.getMessages(), []);
    assert.equal(service.getFinalMessage(), undefined);
    assert.equal(service.getState().status, 'idle');
    assert.equal(service.getState().isStreaming, false);

    registration.setResponses([fauxAssistantMessage('After reset.')]);

    await service.prompt('Second turn');

    const freshMessages = service.getMessages();

    assert.equal(freshMessages.length, 2);
    assert.deepEqual(freshMessages.map((message) => message.role), ['user', 'assistant']);
    assert.equal(readUserText(freshMessages[0]), 'Second turn');
    assert.equal(readAssistantText(service.getFinalMessage()), 'After reset.');
  } finally {
    registration.unregister();
    closeDatabase();
  }
});
