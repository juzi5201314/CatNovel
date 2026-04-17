import assert from 'node:assert/strict';
import test from 'node:test';

import { Type } from '@sinclair/typebox';

import type { AgentEvent } from '../lib/contracts/agent-events.ts';
import { AgentService } from '../lib/server/ai/agent-service.ts';
import {
  createFauxProvider,
  fauxAssistantMessage,
  fauxToolCall,
} from '../lib/server/ai/testing/faux-provider.ts';
import type { ToolDefinition } from '../lib/server/ai/tools/types.ts';
import { closeDatabase } from '../db/client.ts';

function setupMemoryDatabase() {
  closeDatabase();
  process.env.CATNOVEL_DB_MEMORY = 'true';
  delete process.env.CATNOVEL_DATA_DIR;
  delete process.env.CATNOVEL_DB_FILE;
}

test('AgentService emits the full deterministic basic event sequence', async () => {
  setupMemoryDatabase();
  const faux = createFauxProvider();
  faux.setResponse('Hello from faux provider');

  try {
    const service = new AgentService({
      model: faux.model,
      sessionId: 'session-basic-sequence',
    });
    const events = collectEvents(service);

    await service.prompt('Test message');
    await service.waitForIdle();

    assert.deepEqual(
      events.map((event) => event.type),
      [
        'ai_start',
        'ai_state',
        'ai_chunk',
        'ai_chunk',
        'ai_message_snapshot',
        'ai_message_snapshot',
        'ai_complete',
        'ai_state',
      ],
    );
    assert.deepEqual(toMilestoneSequence(events), [
      'agent_start',
      'turn_start',
      'message_start',
      'message_end',
      'turn_end',
      'agent_end',
    ]);
    assertMonotonicTimestamps(events);
    assertSingleSessionAndMessage(events, 'session-basic-sequence');

    const startEvent = expectEventType(events[0], 'ai_start');
    const streamingState = expectEventType(events[1], 'ai_state');
    const openChunk = expectEventType(events[2], 'ai_chunk');
    const textChunk = expectEventType(events[3], 'ai_chunk');
    const partialSnapshot = expectEventType(events[4], 'ai_message_snapshot');
    const finalSnapshot = expectEventType(events[5], 'ai_message_snapshot');
    const completeEvent = expectEventType(events[6], 'ai_complete');
    const completedState = expectEventType(events[7], 'ai_state');

    assert.equal(startEvent.model, faux.model.id);
    assert.equal(streamingState.status, 'streaming');
    assert.equal(streamingState.activeToolName, null);
    assert.equal(openChunk.textDelta, '');
    assert.equal(openChunk.accumulatedText, '');
    assert.equal(textChunk.textDelta, 'Hello from faux provider');
    assert.equal(textChunk.accumulatedText, 'Hello from faux provider');
    assert.equal(partialSnapshot.body, 'Hello from faux provider');
    assert.equal(partialSnapshot.role, 'assistant');
    assert.equal(partialSnapshot.isFinal, false);
    assert.ok(partialSnapshot.tokenCount > 0);
    assert.equal(finalSnapshot.body, 'Hello from faux provider');
    assert.equal(finalSnapshot.tokenCount, partialSnapshot.tokenCount);
    assert.equal(finalSnapshot.isFinal, true);
    assert.equal(completeEvent.fullText, 'Hello from faux provider');
    assert.equal(completedState.status, 'completed');
    assert.equal(completedState.activeToolName, null);
  } finally {
    faux.cleanup();
    closeDatabase();
  }
});

test('AgentService emits deterministic tool call events in sequence', async () => {
  setupMemoryDatabase();

  const faux = createFauxProvider();
  faux.setResponses([
    fauxAssistantMessage([fauxToolCall('demo_tool', { value: 42 }, { id: 'tool-1' })], {
      stopReason: 'toolUse',
    }),
    'Tool finished',
  ]);

  try {
    const service = new AgentService({
      model: faux.model,
      sessionId: 'session-tool-sequence',
      tools: [
        createTestTool('demo_tool', async ({ value }: { value?: number }) => ({
          echoed: value ?? null,
        })),
      ],
    });
    const events = collectEvents(service);

    await service.prompt('Run tool');
    await service.waitForIdle();

    assert.deepEqual(
      events.map((event) => event.type),
      [
        'ai_start',
        'ai_state',
        'ai_chunk',
        'ai_message_snapshot',
        'ai_tool_call',
        'ai_state',
        'ai_tool_result',
        'ai_state',
        'ai_chunk',
        'ai_chunk',
        'ai_message_snapshot',
        'ai_message_snapshot',
        'ai_complete',
        'ai_state',
      ],
    );
    assert.deepEqual(toMilestoneSequence(events), [
      'agent_start',
      'turn_start',
      'message_start',
      'tool_execution_start',
      'tool_execution_end',
      'message_end',
      'turn_end',
      'agent_end',
    ]);
    assertMonotonicTimestamps(events);
    assertSingleSessionAndMessage(events, 'session-tool-sequence');

    const startEvent = expectEventType(events[0], 'ai_start');
    const initialState = expectEventType(events[1], 'ai_state');
    const preToolChunk = expectEventType(events[2], 'ai_chunk');
    const preToolSnapshot = expectEventType(events[3], 'ai_message_snapshot');
    const toolCall = expectEventType(events[4], 'ai_tool_call');
    const toolRunningState = expectEventType(events[5], 'ai_state');
    const toolResult = expectEventType(events[6], 'ai_tool_result');
    const postToolState = expectEventType(events[7], 'ai_state');
    const finalOpenChunk = expectEventType(events[8], 'ai_chunk');
    const finalTextChunk = expectEventType(events[9], 'ai_chunk');
    const partialSnapshot = expectEventType(events[10], 'ai_message_snapshot');
    const finalSnapshot = expectEventType(events[11], 'ai_message_snapshot');
    const completeEvent = expectEventType(events[12], 'ai_complete');
    const completedState = expectEventType(events[13], 'ai_state');

    assert.equal(startEvent.model, faux.model.id);
    assert.equal(initialState.status, 'streaming');
    assert.equal(initialState.activeToolName, null);
    assert.equal(preToolChunk.textDelta, '');
    assert.equal(preToolChunk.accumulatedText, '');
    assert.equal(preToolSnapshot.body, '');
    assert.equal(preToolSnapshot.isFinal, false);
    assert.equal(toolCall.toolCallId, 'tool-1');
    assert.equal(toolCall.toolName, 'demo_tool');
    assert.deepEqual(toolCall.args, { value: 42 });
    assert.equal(toolRunningState.status, 'tool_running');
    assert.equal(toolRunningState.activeToolName, 'demo_tool');
    assert.equal(toolResult.toolCallId, 'tool-1');
    assert.equal(toolResult.toolName, 'demo_tool');
    assert.deepEqual(toolResult.result, { echoed: 42 });
    assert.equal(toolResult.isError, false);
    assert.equal(postToolState.status, 'streaming');
    assert.equal(postToolState.activeToolName, null);
    assert.equal(finalOpenChunk.textDelta, '');
    assert.equal(finalOpenChunk.accumulatedText, '');
    assert.equal(finalTextChunk.textDelta, 'Tool finished');
    assert.equal(finalTextChunk.accumulatedText, 'Tool finished');
    assert.equal(partialSnapshot.body, 'Tool finished');
    assert.equal(partialSnapshot.isFinal, false);
    assert.ok(partialSnapshot.tokenCount > 0);
    assert.equal(finalSnapshot.body, 'Tool finished');
    assert.equal(finalSnapshot.tokenCount, partialSnapshot.tokenCount);
    assert.equal(finalSnapshot.isFinal, true);
    assert.equal(completeEvent.fullText, 'Tool finished');
    assert.equal(completedState.status, 'completed');
    assert.equal(completedState.activeToolName, null);
  } finally {
    faux.cleanup();
    closeDatabase();
  }
});

function createTestTool(
  name: string,
  handler: ToolDefinition['handler'],
): ToolDefinition {
  return {
    name,
    description: `${name} test tool`,
    parameters: Type.Object({
      value: Type.Optional(Type.Number()),
    }),
    handler,
  };
}

function collectEvents(service: AgentService) {
  const events: AgentEvent[] = [];
  service.subscribe((event) => {
    events.push(event);
  });
  return events;
}

function assertMonotonicTimestamps(events: AgentEvent[]) {
  for (let index = 1; index < events.length; index += 1) {
    assert.ok(
      events[index].timestamp >= events[index - 1].timestamp,
      `Expected timestamp ${events[index].timestamp} to be >= ${events[index - 1].timestamp}`,
    );
  }
}

function assertSingleSessionAndMessage(events: AgentEvent[], sessionId: string) {
  assert.ok(events.length > 0);

  const messageId = events[0].messageId;
  assert.ok(messageId.length > 0);

  for (const event of events) {
    assert.equal(event.sessionId, sessionId);
    assert.equal(event.messageId, messageId);
  }
}

function toMilestoneSequence(events: AgentEvent[]) {
  const milestones: string[] = [];
  const expectsToolCall = events.some((event) => event.type === 'ai_tool_call');
  let sawTurnStart = false;
  let sawMessageStart = false;

  for (const event of events) {
    switch (event.type) {
      case 'ai_start':
        milestones.push('agent_start');
        break;

      case 'ai_state':
        if (!sawTurnStart && event.status === 'streaming') {
          sawTurnStart = true;
          milestones.push('turn_start');
          break;
        }

        if (event.status === 'completed') {
          milestones.push('agent_end');
        }
        break;

      case 'ai_chunk':
        if (!sawMessageStart) {
          sawMessageStart = true;
          milestones.push('message_start');
        }
        break;

      case 'ai_tool_call':
        milestones.push('tool_execution_start');
        break;

      case 'ai_tool_result':
        milestones.push('tool_execution_end');
        break;

      case 'ai_message_snapshot':
        if (!event.isFinal && (!expectsToolCall || event.body.length > 0)) {
          milestones.push('message_end');
        }
        break;

      case 'ai_complete':
        milestones.push('turn_end');
        break;

      default:
        break;
    }
  }

  return milestones;
}

function expectEventType<T extends AgentEvent['type']>(
  event: AgentEvent | undefined,
  expectedType: T,
): Extract<AgentEvent, { type: T }> {
  assert.ok(event);
  assert.equal(event.type, expectedType);
  return event as Extract<AgentEvent, { type: T }>;
}
