import assert from 'node:assert/strict';
import test from 'node:test';

import { getModel } from '@mariozechner/pi-ai';

import { AgentService } from '../lib/server/ai/agent-service.ts';

type QueueMode = 'all' | 'one-at-a-time';

interface PendingMessageQueue {
  mode: QueueMode;
  drain(): Array<{
    role: string;
    content: unknown;
    timestamp: number;
  }>;
}

interface AgentInternals {
  steeringMode: QueueMode;
  followUpMode: QueueMode;
  steeringQueue: PendingMessageQueue;
  followUpQueue: PendingMessageQueue;
}

function createService(config?: {
  steeringMode?: QueueMode;
  followUpMode?: QueueMode;
}): AgentService {
  return new AgentService({
    model: getModel('openai', 'gpt-4o-mini'),
    ...config,
  });
}

function getInternalAgent(service: AgentService): AgentInternals {
  return (service as unknown as { agent: AgentInternals }).agent;
}

test('steer queues user messages with one-at-a-time mode by default', () => {
  const service = createService();
  const internalAgent = getInternalAgent(service);

  service.steer('first steer');
  service.steer('second steer');

  assert.equal(internalAgent.steeringMode, 'one-at-a-time');

  const firstDrain = internalAgent.steeringQueue.drain();
  const secondDrain = internalAgent.steeringQueue.drain();

  assert.deepEqual(
    firstDrain.map((message) => ({ role: message.role, content: message.content })),
    [{ role: 'user', content: 'first steer' }],
  );
  assert.deepEqual(
    secondDrain.map((message) => ({ role: message.role, content: message.content })),
    [{ role: 'user', content: 'second steer' }],
  );
  assert.equal(typeof firstDrain[0]?.timestamp, 'number');
});

test('followUp queues user messages with one-at-a-time mode by default', () => {
  const service = createService();
  const internalAgent = getInternalAgent(service);

  service.followUp('first follow-up');
  service.followUp('second follow-up');

  assert.equal(internalAgent.followUpMode, 'one-at-a-time');

  const firstDrain = internalAgent.followUpQueue.drain();
  const secondDrain = internalAgent.followUpQueue.drain();

  assert.deepEqual(
    firstDrain.map((message) => ({ role: message.role, content: message.content })),
    [{ role: 'user', content: 'first follow-up' }],
  );
  assert.deepEqual(
    secondDrain.map((message) => ({ role: message.role, content: message.content })),
    [{ role: 'user', content: 'second follow-up' }],
  );
  assert.equal(typeof firstDrain[0]?.timestamp, 'number');
});

test('supports configuring and updating steering/follow-up queue modes', () => {
  const service = createService({
    steeringMode: 'all',
    followUpMode: 'all',
  });
  const internalAgent = getInternalAgent(service);

  assert.equal(internalAgent.steeringMode, 'all');
  assert.equal(internalAgent.followUpMode, 'all');

  service.setSteeringMode('one-at-a-time');
  service.setFollowUpMode('one-at-a-time');

  assert.equal(internalAgent.steeringMode, 'one-at-a-time');
  assert.equal(internalAgent.followUpMode, 'one-at-a-time');
});

test('clearSteeringQueue and clearFollowUpQueue drop pending messages', () => {
  const service = createService({
    steeringMode: 'all',
    followUpMode: 'all',
  });
  const internalAgent = getInternalAgent(service);

  service.steer('discard steer');
  service.followUp('discard follow-up');

  service.clearSteeringQueue();
  service.clearFollowUpQueue();

  assert.deepEqual(internalAgent.steeringQueue.drain(), []);
  assert.deepEqual(internalAgent.followUpQueue.drain(), []);
});
