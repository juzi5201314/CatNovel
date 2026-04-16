import type { AgentTool } from '@mariozechner/pi-agent-core';

import {
  isPublicAgentEvent,
  type AgentEvent,
} from '../../../../lib/contracts/agent-events.ts';
import { AgentService } from '../../../../lib/server/ai/agent-service.ts';
import type { ContextSelection } from '../../../../lib/server/ai/context-engine.ts';
import { getModelFromProfile } from '../../../../lib/server/ai/pi-transport-adapter.ts';
import {
  findProviderProfile,
  type ProviderProfile,
} from '../../../../lib/server/ai/provider-registry.ts';
import type { ToolDefinition } from '../../../../lib/server/ai/tools/types.ts';

const encoder = new TextEncoder();

const sseHeaders = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache, no-transform',
  connection: 'keep-alive',
} as const;

interface AgentRequestPayload {
  prompt?: string;
  profileId?: string;
  providerProfile?: ProviderProfile;
  systemPrompt?: string;
  tools?: Array<AgentTool | ToolDefinition>;
  contextSelection?: Partial<ContextSelection>;
  chapter?: string;
  settings?: string[];
  summaries?: string[];
  manualSelections?: string[];
  steeringMode?: 'all' | 'one-at-a-time';
  followUpMode?: 'all' | 'one-at-a-time';
  sessionId?: string;
}

export async function POST(request: Request) {
  let payload: AgentRequestPayload;

  try {
    payload = (await request.json()) as AgentRequestPayload;
  } catch {
    return Response.json({
      error: 'Invalid JSON payload.',
    }, {
      status: 400,
    });
  }

  const prompt = payload.prompt?.trim();
  if (!prompt) {
    return Response.json({
      error: 'prompt is required',
    }, {
      status: 400,
    });
  }

  let providerProfile: ProviderProfile;
  try {
    providerProfile = resolveProviderProfile(payload);
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Invalid provider profile.',
    }, {
      status: 400,
    });
  }

  let model;
  try {
    ({ model } = getModelFromProfile(providerProfile));
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Failed to create agent model.',
    }, {
      status: 400,
    });
  }

  const agent = new AgentService({
    model,
    systemPrompt: payload.systemPrompt,
    tools: payload.tools,
    contextSelection: buildContextSelection(payload),
    steeringMode: payload.steeringMode,
    followUpMode: payload.followUpMode,
    sessionId: payload.sessionId,
  });
  const fallbackMessageId = crypto.randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let streamClosed = false;

      const closeStream = () => {
        if (streamClosed) {
          return;
        }

        streamClosed = true;
        detachAbortListener();
        unsubscribe();
        controller.close();
      };

      const emitEvent = (event: AgentEvent) => {
        if (!isPublicAgentEvent(event) || streamClosed) {
          return;
        }

        controller.enqueue(encoder.encode(formatSseEvent(event)));

        if (event.type === 'ai_complete' || event.type === 'ai_error') {
          closeStream();
        }
      };

      const unsubscribe = agent.subscribe(emitEvent);

      const abortHandler = () => {
        agent.abort();
      };

      const detachAbortListener = () => {
        request.signal.removeEventListener('abort', abortHandler);
      };

      request.signal.addEventListener('abort', abortHandler, { once: true });

      void agent.prompt(prompt).catch((error: unknown) => {
        if (streamClosed) {
          return;
        }

        controller.enqueue(encoder.encode(formatSseEvent({
          type: 'ai_error',
          error: error instanceof Error ? error.message : 'Agent run failed.',
          timestamp: Date.now(),
          sessionId: agent.getState().sessionId,
          messageId: fallbackMessageId,
        })));
        closeStream();
      });
    },
    cancel() {
      agent.abort();
    },
  });

  return new Response(stream, {
    headers: sseHeaders,
  });
}

function resolveProviderProfile(payload: AgentRequestPayload): ProviderProfile {
  if (payload.providerProfile) {
    return payload.providerProfile;
  }

  if (payload.profileId) {
    return findProviderProfile(payload.profileId);
  }

  throw new Error('providerProfile or profileId is required');
}

function buildContextSelection(payload: AgentRequestPayload): ContextSelection {
  return {
    chapter: payload.contextSelection?.chapter ?? payload.chapter ?? '',
    settings: [...(payload.contextSelection?.settings ?? payload.settings ?? [])],
    summaries: [...(payload.contextSelection?.summaries ?? payload.summaries ?? [])],
    manualSelections: [
      ...(payload.contextSelection?.manualSelections ?? payload.manualSelections ?? []),
    ],
  };
}

function formatSseEvent(event: AgentEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
