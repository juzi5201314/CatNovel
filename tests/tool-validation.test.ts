import assert from 'node:assert/strict';
import test from 'node:test';

import { fauxAssistantMessage, fauxToolCall, registerFauxProvider } from '@mariozechner/pi-ai';
import { Type } from '@sinclair/typebox';

import type { AgentEvent } from '../lib/contracts/agent-events.ts';
import { AgentService } from '../lib/server/ai/agent-service.ts';
import { executeToolWithSafety } from '../lib/server/ai/tool-execution.ts';
import { tools } from '../lib/server/ai/tools/index.ts';
import type { ToolDefinition } from '../lib/server/ai/tools/types.ts';

function createTestTool(
  name: string,
  handler: ToolDefinition['handler'],
): ToolDefinition {
  return {
    name,
    description: `${name} test tool`,
    parameters: Type.Object({}),
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

function getLastToolResultMessage(messages: Array<{ role: string }>) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role === 'toolResult') {
      return message as {
        role: 'toolResult';
        toolName: string;
        isError: boolean;
        content: Array<{ type: string; text?: string }>;
      };
    }
  }

  return undefined;
}

function readTextContent(content: Array<{ type: string; text?: string }>) {
  return content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

test('invalid TypeBox parameters return a tool error result instead of throwing', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const registration = registerFauxProvider({
    api: `faux-api-${suffix}`,
    provider: `faux-provider-${suffix}`,
    models: [{ id: `faux-model-${suffix}` }],
  });

  registration.setResponses([
    fauxAssistantMessage([fauxToolCall('read_chapter', { chapterId: ['bad-id'] })], {
      stopReason: 'toolUse',
    }),
    (context) => {
      const toolResult = getLastToolResultMessage(context.messages as Array<{ role: string }>);

      assert.ok(toolResult);
      assert.equal(toolResult.toolName, 'read_chapter');
      assert.equal(toolResult.isError, true);

      const text = readTextContent(toolResult.content);
      assert.match(text, /validation failed/i);
      assert.match(text, /chapterId/i);

      return fauxAssistantMessage('validation error handled');
    },
  ]);

  try {
    const service = new AgentService({
      model: registration.getModel(),
      tools,
    });
    const events = collectEvents(service);

    await assert.doesNotReject(() => service.prompt('读取章节'));

    const toolResultEvent = findToolResultEvent(events);
    assert.ok(toolResultEvent);
    assert.equal(toolResultEvent.isError, true);
  } finally {
    registration.unregister();
  }
});

test('tool timeout returns an error result', async () => {
  const tool = createTestTool('slow_tool', async () => {
    await new Promise(() => undefined);
    return 'done';
  });

  const result = await executeToolWithSafety(tool, {}, { timeoutMs: 20 });

  assert.equal(result.isError, true);
  assert.match(String(result.result.details), /timed out after 20ms/);
  assert.match(result.result.content[0]?.text ?? '', /timed out after 20ms/);
});

test('tool cancellation returns an aborted tool error result', async () => {
  const tool = createTestTool('abortable_tool', async () => {
    await new Promise(() => undefined);
    return 'done';
  });
  const controller = new AbortController();

  setTimeout(() => controller.abort(), 10);

  const result = await executeToolWithSafety(tool, {}, {}, controller.signal);

  assert.equal(result.isError, true);
  assert.match(String(result.result.details), /was aborted/);
  assert.match(result.result.content[0]?.text ?? '', /was aborted/);
});
