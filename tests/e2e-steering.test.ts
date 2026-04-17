import assert from 'node:assert/strict';
import test from 'node:test';

import type { AgentMessage } from '@mariozechner/pi-agent-core';

import type { AgentEvent } from '../lib/contracts/agent-events.ts';
import { AgentService } from '../lib/server/ai/agent-service.ts';
import { createFauxProvider } from '../lib/server/ai/testing/faux-provider.ts';
import { closeDatabase } from '../db/client.ts';

function setupMemoryDatabase() {
  closeDatabase();
  process.env.CATNOVEL_DB_MEMORY = 'true';
  delete process.env.CATNOVEL_DATA_DIR;
  delete process.env.CATNOVEL_DB_FILE;
}

test('steering messages injected during streaming become a follow-on user turn', async () => {
  setupMemoryDatabase();
  const faux = createFauxProvider({ tokensPerSecond: 6 });
  faux.setResponses([
    'This opening reply is intentionally paced to keep the stream active for steering.',
    'Steering applied.',
  ]);

  try {
    const service = new AgentService({
      model: faux.model,
      sessionId: 'e2e-steering-session',
    });
    const firstTextChunk = waitForEvent(
      service,
      (event) => event.type === 'ai_chunk' && event.textDelta.length > 0,
    );

    const run = service.prompt('Start the conversation');

    await firstTextChunk;
    service.steer('Please switch to a colder tone.');

    await run;
    await service.waitForIdle();

    const userMessages = service.getMessages().filter((message) => message.role === 'user');
    const assistantMessages = service.getMessages().filter((message) => message.role === 'assistant');

    assert.deepEqual(userMessages.map(readUserText), [
      'Start the conversation',
      'Please switch to a colder tone.',
    ]);
    assert.deepEqual(assistantMessages.map(readAssistantText), [
      'This opening reply is intentionally paced to keep the stream active for steering.',
      'Steering applied.',
    ]);
    assert.equal(readAssistantText(service.getFinalMessage()), 'Steering applied.');
    assert.equal(faux.registration.state.callCount, 2);
  } finally {
    faux.cleanup();
    closeDatabase();
  }
});

test('follow-up messages injected during streaming become a queued next turn', async () => {
  setupMemoryDatabase();

  const faux = createFauxProvider({ tokensPerSecond: 6 });
  faux.setResponses([
    'The first answer stays open just long enough for follow-up injection.',
    'Follow-up handled.',
  ]);

  try {
    const service = new AgentService({
      model: faux.model,
      sessionId: 'e2e-follow-up-session',
    });
    const firstTextChunk = waitForEvent(
      service,
      (event) => event.type === 'ai_chunk' && event.textDelta.length > 0,
    );

    const run = service.prompt('Give me a first answer');

    await firstTextChunk;
    service.followUp('Add one more practical next step.');

    await run;
    await service.waitForIdle();

    const userMessages = service.getMessages().filter((message) => message.role === 'user');
    const assistantMessages = service.getMessages().filter((message) => message.role === 'assistant');

    assert.deepEqual(userMessages.map(readUserText), [
      'Give me a first answer',
      'Add one more practical next step.',
    ]);
    assert.deepEqual(assistantMessages.map(readAssistantText), [
      'The first answer stays open just long enough for follow-up injection.',
      'Follow-up handled.',
    ]);
    assert.equal(readAssistantText(service.getFinalMessage()), 'Follow-up handled.');
    assert.equal(faux.registration.state.callCount, 2);
  } finally {
    faux.cleanup();
    closeDatabase();
  }
});

function waitForEvent(
  service: AgentService,
  predicate: (event: AgentEvent) => boolean,
): Promise<AgentEvent> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error('Timed out waiting for matching agent event.'));
    }, 5_000);

    const unsubscribe = service.subscribe((event) => {
      if (!predicate(event)) {
        return;
      }

      clearTimeout(timeout);
      unsubscribe();
      resolve(event);
    });
  });
}

function readUserText(message: AgentMessage | undefined): string {
  if (!message || message.role !== 'user') {
    assert.fail('Expected a user message.');
  }

  return typeof message.content === 'string'
    ? message.content
    : message.content
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
