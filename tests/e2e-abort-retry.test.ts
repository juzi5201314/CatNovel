import assert from 'node:assert/strict';
import test from 'node:test';

import type { AgentMessage } from '@mariozechner/pi-agent-core';
import type { AssistantMessage } from '@mariozechner/pi-ai';

import type { AgentEvent } from '../lib/contracts/agent-events.ts';
import { AgentService } from '../lib/server/ai/agent-service.ts';
import {
  createFauxProvider,
  fauxAssistantMessage,
} from '../lib/server/ai/testing/faux-provider.ts';
import { closeDatabase } from '../db/client.ts';

function setupMemoryDatabase() {
  closeDatabase();
  process.env.CATNOVEL_DB_MEMORY = 'true';
  delete process.env.CATNOVEL_DATA_DIR;
  delete process.env.CATNOVEL_DB_FILE;
}

test('abort preserves the partial assistant message and continue retries successfully', async () => {
  setupMemoryDatabase();
  const abortedResponse = 'This partial answer survives the abort boundary.';
  const retriedResponse = 'Retry finishes the answer cleanly.';
  const faux = createFauxProvider();
  faux.setResponses([
    fauxAssistantMessage(abortedResponse, {
      stopReason: 'aborted',
      errorMessage: 'Request was aborted',
    }),
    retriedResponse,
  ]);

  try {
    const service = new AgentService({
      model: faux.model,
      sessionId: 'e2e-abort-retry-session',
    });
    const events: AgentEvent[] = [];

    service.subscribe((event) => {
      events.push(event);
    });

    await service.prompt('Write a long answer');
    await service.waitForIdle();

    const partialMessage = service.getFinalMessage();
    assert.ok(partialMessage);
    assert.equal(partialMessage.stopReason, 'aborted');

    const partialText = readAssistantText(partialMessage);
    assert.ok(partialText.length > 0);
    assert.equal(partialText, abortedResponse);
    assert.equal(faux.getPendingCount(), 1);
    assert.ok(
      events.some(
        (event) => event.type === 'ai_error' && /abort/i.test(event.error),
      ),
    );

    service.followUp('Please continue from the partial answer.');
    await service.continue();
    await service.waitForIdle();

    const messages = service.getMessages();
    const assistantMessages = messages.filter(
      (message): message is AssistantMessage => message.role === 'assistant',
    );
    const userMessages = messages.filter((message) => message.role === 'user');

    assert.equal(readAssistantText(service.getFinalMessage()), retriedResponse);
    assert.deepEqual(userMessages.map(readUserText), [
      'Write a long answer',
      'Please continue from the partial answer.',
    ]);
    assert.ok(assistantMessages.some((message) => message.stopReason === 'aborted'));
    assert.ok(assistantMessages.some((message) => readAssistantText(message) === retriedResponse));
    assert.equal(faux.registration.state.callCount, 2);
    assert.equal(faux.getPendingCount(), 0);
  } finally {
    faux.cleanup();
    closeDatabase();
  }
});

function readAssistantText(message: AgentMessage | undefined): string {
  if (!message || message.role !== 'assistant') {
    assert.fail('Expected an assistant message.');
  }

  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
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
