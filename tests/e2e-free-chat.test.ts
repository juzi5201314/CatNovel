import assert from 'node:assert/strict';
import test from 'node:test';

import { POST } from '../app/api/ai/agent/route.ts';
import type { PublicAgentEvent } from '../lib/contracts/agent-events.ts';
import { createFauxProvider } from '../lib/server/ai/testing/faux-provider.ts';

test('free-chat complete flow streams deterministic SSE events through the agent route', async () => {
  const faux = createFauxProvider({
    api: 'openai-completions',
    provider: 'catnovel-openai-compatible',
    models: [{ id: 'faux-route-model' }],
  });
  faux.setResponse('Hello! How can I help you today?');

  try {
    const response = await POST(
      new Request('http://localhost/api/ai/agent', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Hi',
          providerProfile: buildRouteProviderProfile(faux.model.id),
        }),
      }),
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);

    const events = await collectSseEvents(response);

    assert.deepEqual(events.map((event) => event.type), [
      'ai_start',
      'ai_chunk',
      'ai_chunk',
      'ai_complete',
    ]);

    const startEvent = expectEventType(events[0], 'ai_start');
    const openChunk = expectEventType(events[1], 'ai_chunk');
    const textChunk = expectEventType(events[2], 'ai_chunk');
    const completeEvent = expectEventType(events[3], 'ai_complete');

    assert.equal(startEvent.model, faux.model.id);
    assert.equal(openChunk.textDelta, '');
    assert.equal(openChunk.accumulatedText, '');
    assert.equal(textChunk.textDelta, 'Hello! How can I help you today?');
    assert.equal(textChunk.accumulatedText, 'Hello! How can I help you today?');
    assert.equal(completeEvent.fullText, 'Hello! How can I help you today?');

    assertConsistentSession(events);
    assert.equal(faux.registration.state.callCount, 1);
    assert.equal(faux.getPendingCount(), 0);
  } finally {
    faux.cleanup();
  }
});

function buildRouteProviderProfile(modelId: string) {
  return {
    id: 'faux-openai-compatible-profile',
    label: 'Faux route profile',
    family: 'openai-compatible' as const,
    endpoint: 'http://faux.local/v1',
    apiKey: 'faux-key',
    modelIds: [modelId],
    enabled: true,
  };
}

async function collectSseEvents(response: Response): Promise<PublicAgentEvent[]> {
  const reader = response.body?.getReader();
  if (!reader) {
    return [];
  }

  const decoder = new TextDecoder();
  let buffer = '';
  const events: PublicAgentEvent[] = [];

  while (true) {
    const next = await reader.read();
    if (next.done) {
      buffer += decoder.decode();
      drainSseBuffer(buffer, events);
      return events;
    }

    buffer += decoder.decode(next.value, { stream: true });
    const lastBoundary = buffer.lastIndexOf('\n\n');
    if (lastBoundary === -1) {
      continue;
    }

    const completePayload = buffer.slice(0, lastBoundary + 2);
    buffer = buffer.slice(lastBoundary + 2);
    drainSseBuffer(completePayload, events);
  }
}

function drainSseBuffer(buffer: string, events: PublicAgentEvent[]) {
  for (const rawEvent of buffer.split('\n\n')) {
    const trimmed = rawEvent.trim();
    if (!trimmed) {
      continue;
    }

    let eventType = '';
    const dataLines: string[] = [];

    for (const line of trimmed.split('\n')) {
      if (line.startsWith('event: ')) {
        eventType = line.slice('event: '.length);
      }
      if (line.startsWith('data: ')) {
        dataLines.push(line.slice('data: '.length));
      }
    }

    if (!eventType || dataLines.length === 0) {
      continue;
    }

    events.push(JSON.parse(dataLines.join('\n')) as PublicAgentEvent);
  }
}

function assertConsistentSession(events: PublicAgentEvent[]) {
  assert.ok(events.length > 0);

  const sessionId = events[0]?.sessionId;
  const messageId = events[0]?.messageId;

  assert.ok(sessionId);
  assert.ok(messageId);

  for (const event of events) {
    assert.equal(event.sessionId, sessionId);
    assert.equal(event.messageId, messageId);
  }
}

function expectEventType<T extends PublicAgentEvent['type']>(
  event: PublicAgentEvent | undefined,
  expectedType: T,
): Extract<PublicAgentEvent, { type: T }> {
  assert.ok(event);
  assert.equal(event.type, expectedType);
  return event as Extract<PublicAgentEvent, { type: T }>;
}
