import assert from 'node:assert/strict';
import test from 'node:test';

import { fauxAssistantMessage, fauxToolCall, registerFauxProvider } from '@mariozechner/pi-ai';
import { Type } from '@sinclair/typebox';

import { closeDatabase } from '../db/client.ts';
import type { AgentEvent } from '../lib/contracts/agent-events.ts';
import { AgentService } from '../lib/server/ai/agent-service.ts';
import {
  executeToolWithSafety,
  type ToolExecutionConfig,
} from '../lib/server/ai/tool-execution.ts';
import type { ToolDefinition } from '../lib/server/ai/tools/types.ts';

function createTestTool(
  name: string,
  handler: ToolDefinition['handler'],
): ToolDefinition {
  return {
    name,
    description: `${name} test tool`,
    parameters: Type.Object({
      text: Type.Optional(Type.String()),
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

function findToolResultEvent(events: AgentEvent[]) {
  return events.find((event) => event.type === 'ai_tool_result');
}

function setupMemoryDatabase() {
  closeDatabase();
  process.env.CATNOVEL_DB_MEMORY = 'true';
  delete process.env.CATNOVEL_DATA_DIR;
  delete process.env.CATNOVEL_DB_FILE;
}

test('executeToolWithSafety blocks tool calls before execution', async () => {
  setupMemoryDatabase();

  try {
    const tool = createTestTool('blocked_tool', async () => 'should not run');

    const result = await executeToolWithSafety(
      tool,
      { text: 'hello' },
      {
        beforeToolCall: () => ({ block: true, reason: 'policy blocked' }),
      },
    );

    assert.equal(result.isError, true);
    assert.equal(result.result.details, 'policy blocked');
    assert.equal(result.result.content[0]?.type, 'text');
    assert.equal(result.result.content[0]?.text, 'policy blocked');
  } finally {
    closeDatabase();
  }
});

test('executeToolWithSafety converts thrown errors into tool results', async () => {
  setupMemoryDatabase();

  try {
    const tool = createTestTool('failing_tool', async () => {
      throw new Error('tool exploded');
    });

    const result = await executeToolWithSafety(tool, {}, {});

    assert.equal(result.isError, true);
    assert.equal(result.result.details, 'tool exploded');
    assert.equal(result.result.content[0]?.text, 'tool exploded');
  } finally {
    closeDatabase();
  }
});

test('executeToolWithSafety aborts long-running tools on timeout', async () => {
  setupMemoryDatabase();

  try {
    const tool = createTestTool('slow_tool', async () => {
      await new Promise(() => undefined);
      return 'done';
    });

    const result = await executeToolWithSafety(tool, {}, { timeoutMs: 20 });

    assert.equal(result.isError, true);
    assert.match(String(result.result.details), /timed out after 20ms/);
    assert.match(result.result.content[0]?.text ?? '', /timed out after 20ms/);
  } finally {
    closeDatabase();
  }
});

test('executeToolWithSafety respects external abort signals', async () => {
  setupMemoryDatabase();

  try {
    const tool = createTestTool('abortable_tool', async () => {
      await new Promise(() => undefined);
      return 'done';
    });
    const controller = new AbortController();

    setTimeout(() => controller.abort(), 10);

    const result = await executeToolWithSafety(tool, {}, {}, controller.signal);

    assert.equal(result.isError, true);
    assert.match(String(result.result.details), /was aborted/);
  } finally {
    closeDatabase();
  }
});

test('AgentService wraps ToolDefinition results and applies afterToolCall formatting', async () => {
  setupMemoryDatabase();

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const registration = registerFauxProvider({
    api: `faux-api-${suffix}`,
    provider: `faux-provider-${suffix}`,
    models: [{ id: `faux-model-${suffix}` }],
  });
  const tool = createTestTool('format_tool', async ({ text }: { text?: string }) => ({
    echoed: text ?? '',
  }));

  registration.setResponses([
    fauxAssistantMessage([fauxToolCall('format_tool', { text: 'hi' })], {
      stopReason: 'toolUse',
    }),
    fauxAssistantMessage('formatted'),
  ]);

  try {
    const service = new AgentService({
      model: registration.getModel(),
      tools: [tool],
      toolExecution: {
        afterToolCall: (_toolName, result, isError) => {
          assert.equal(isError, false);
          return {
            payload: result,
            audited: true,
          };
        },
      },
    });
    const events = collectEvents(service);

    await service.prompt('run formatter');

    const toolResultEvent = findToolResultEvent(events);
    assert.ok(toolResultEvent);
    assert.equal(toolResultEvent.isError, false);
    assert.deepEqual(toolResultEvent.result, {
      payload: { echoed: 'hi' },
      audited: true,
    });
  } finally {
    registration.unregister();
    closeDatabase();
  }
});

test('AgentService surfaces beforeToolCall blocks as tool errors', async () => {
  setupMemoryDatabase();

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const registration = registerFauxProvider({
    api: `faux-api-${suffix}`,
    provider: `faux-provider-${suffix}`,
    models: [{ id: `faux-model-${suffix}` }],
  });
  const tool = createTestTool('blocked_agent_tool', async () => 'unreachable');
  const toolExecution: ToolExecutionConfig = {
    beforeToolCall: () => ({ block: true, reason: 'blocked by policy' }),
  };

  registration.setResponses([
    fauxAssistantMessage([fauxToolCall('blocked_agent_tool', {})], {
      stopReason: 'toolUse',
    }),
    fauxAssistantMessage('blocked'),
  ]);

  try {
    const service = new AgentService({
      model: registration.getModel(),
      tools: [tool],
      toolExecution,
    });
    const events = collectEvents(service);

    await service.prompt('run blocker');

    const toolResultEvent = findToolResultEvent(events);
    assert.ok(toolResultEvent);
    assert.equal(toolResultEvent.isError, true);
    assert.equal(toolResultEvent.result, 'blocked by policy');
  } finally {
    registration.unregister();
    closeDatabase();
  }
});
