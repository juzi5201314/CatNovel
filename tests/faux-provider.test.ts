import assert from 'node:assert/strict';
import test from 'node:test';

import { complete, stream } from '@mariozechner/pi-ai';

import {
  createFauxProvider,
  fauxAssistantMessage,
  fauxText,
  fauxThinking,
  fauxToolCall,
} from '../lib/server/ai/testing/faux-provider.ts';

test('createFauxProvider registers a faux model and drains queued responses', async () => {
  const faux = createFauxProvider();

  try {
    assert.equal(faux.providerId, faux.model.id);
    assert.equal(faux.getPendingCount(), 0);

    faux.setResponses(['first reply', 'second reply']);

    assert.equal(faux.getPendingCount(), 2);

    const first = await complete(faux.model, createContext('hello'));
    const second = await complete(faux.model, createContext('again'));

    assert.equal(readText(first), 'first reply');
    assert.equal(readText(second), 'second reply');
    assert.equal(faux.getPendingCount(), 0);
    assert.equal(faux.registration.state.callCount, 2);
  } finally {
    faux.cleanup();
  }
});

test('supports appending scripted responses for deterministic follow-up turns', async () => {
  const faux = createFauxProvider();

  try {
    faux.setResponse('turn one');
    faux.appendResponse((_context, _options, state) =>
      fauxAssistantMessage(fauxText(`turn ${state.callCount}`)),
    );

    assert.equal(faux.getPendingCount(), 2);

    const first = await complete(faux.model, createContext('first turn'));
    const second = await complete(faux.model, createContext('second turn'));

    assert.equal(readText(first), 'turn one');
    assert.equal(readText(second), 'turn 2');
    assert.equal(faux.registration.state.callCount, 2);
    assert.equal(faux.getPendingCount(), 0);
  } finally {
    faux.cleanup();
  }
});

test('uses a predictable streaming event sequence for structured responses', async () => {
  const faux = createFauxProvider();

  try {
    faux.setResponse(
      fauxAssistantMessage(
        [
          fauxThinking('Plan the next step.'),
          fauxToolCall('lookup_note', { chapterId: 'ch-1' }, { id: 'tool-1' }),
          fauxText('Ready to continue.'),
        ],
        { stopReason: 'toolUse' },
      ),
    );

    const events: string[] = [];
    const responseStream = stream(faux.model, createContext('continue'));

    for await (const event of responseStream) {
      events.push(event.type);
    }

    const result = await responseStream.result();

    assert.deepEqual(events, [
      'start',
      'thinking_start',
      'thinking_delta',
      'thinking_end',
      'toolcall_start',
      'toolcall_delta',
      'toolcall_end',
      'text_start',
      'text_delta',
      'text_end',
      'done',
    ]);
    assert.equal(result.stopReason, 'toolUse');
    assert.deepEqual(
      result.content.map((block) => block.type),
      ['thinking', 'toolCall', 'text'],
    );
    assert.equal(faux.getPendingCount(), 0);
  } finally {
    faux.cleanup();
  }
});

function createContext(userMessage: string) {
  return {
    messages: [
      {
        role: 'user' as const,
        content: userMessage,
        timestamp: Date.now(),
      },
    ],
  };
}

function readText(message: { content: Array<{ type: string }> }) {
  return message.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}
