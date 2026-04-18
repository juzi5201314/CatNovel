import type { AgentTool } from '@mariozechner/pi-agent-core';

import {
  isPublicAgentEvent,
  type AgentEvent,
} from '../../../../lib/contracts/agent-events.ts';
import { AgentService, submitUserResponse } from '../../../../lib/server/ai/agent-service.ts';
import { deletePendingAskUserQuestion } from '../../../../lib/server/repositories/chat-repository.ts';
import { tools as defaultTools } from '../../../../lib/server/ai/tools/index.ts';
import type { ContextSelection } from '../../../../lib/server/ai/context-engine.ts';
import { getModelFromProfile } from '../../../../lib/server/ai/pi-transport-adapter.ts';
import {
  findProviderProfile,
  type ProviderProfile,
} from '../../../../lib/server/ai/provider-registry.ts';
import type { ToolDefinition } from '../../../../lib/server/ai/tools/types.ts';
import { getChatSession } from '../../../../lib/server/repositories/chat-repository.ts';
import { getContextSelectionBySource } from '../../../../lib/server/repositories/context-selection-repository.ts';
import { getChapterSummary } from '../../../../lib/server/repositories/chapter-summary-repository.ts';
import { getChapterById } from '../../../../lib/server/repositories/chapter-repository.ts';
import { listSettingsNodes } from '../../../../lib/server/repositories/settings-repository.ts';

const encoder = new TextEncoder();

const sseHeaders = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache, no-transform',
  connection: 'keep-alive',
} as const;

interface AgentRequestPayload {
  prompt?: string;
  profileId?: string;
  modelId?: string;
  providerProfile?: ProviderProfile;
  systemPrompt?: string;
  tools?: Array<AgentTool | ToolDefinition>;
  steeringMode?: 'all' | 'one-at-a-time';
  followUpMode?: 'all' | 'one-at-a-time';
  sessionId: string;
  upToMessageId?: string;
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

  const sessionId = payload.sessionId?.trim();
  if (!sessionId) {
    return Response.json({
      error: 'sessionId is required',
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

  let modelResult;
  try {
    modelResult = getModelFromProfile(providerProfile, payload.modelId);
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Failed to create agent model.',
    }, {
      status: 400,
    });
  }

  let contextSelection: ContextSelection;
  try {
    contextSelection = buildContextSelectionFromSession(sessionId);
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Failed to build context from session.',
    }, {
      status: 400,
    });
  }

  const agent = new AgentService({
    model: modelResult.model,
    apiKey: modelResult.apiKey,
    systemPrompt: payload.systemPrompt,
    tools: payload.tools ?? defaultTools,
    contextSelection,
    steeringMode: payload.steeringMode,
    followUpMode: payload.followUpMode,
    sessionId,
    upToMessageId: payload.upToMessageId,
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
        try {
          controller.close();
        } catch {
          // Controller 可能已被关闭（如 cancel 回调触发），忽略错误
        }
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

        // 如果用户主动中止，不需要发送错误事件
        if (error instanceof Error && error.name === 'AbortError') {
          closeStream();
          return;
        }

        try {
          controller.enqueue(encoder.encode(formatSseEvent({
            type: 'ai_error',
            error: error instanceof Error ? error.message : 'Agent run failed.',
            timestamp: Date.now(),
            sessionId: agent.getState().sessionId,
            messageId: fallbackMessageId,
          })));
        } catch {
          // Controller 可能已关闭，忽略错误
        }
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

function buildContextSelectionFromSession(sessionId: string): ContextSelection {
  const chatSession = getChatSession(sessionId);

  const contextSelection = getContextSelectionBySource('chat-session', sessionId);

  let chapter = '';
  const summaries: string[] = [];

  if (contextSelection?.chapterId) {
    const chapterRecord = getChapterById(contextSelection.chapterId);
    if (chapterRecord?.plaintext) {
      chapter = chapterRecord.plaintext;
    }

    const summaryRecord = getChapterSummary(contextSelection.chapterId);
    if (summaryRecord?.summary) {
      summaries.push(summaryRecord.summary);
    }
  }

  const settingsNodes = listSettingsNodes(chatSession.workId);
  const settings = settingsNodes.map((node) => {
    try {
      const payload = JSON.parse(node.payloadJson);
      return `${node.title}: ${payload.description ?? payload.content ?? ''}`;
    } catch {
      return `${node.title}: ${node.payloadJson}`;
    }
  });

  return {
    chapter,
    settings,
    summaries,
    manualSelections: [],
  };
}

function formatSseEvent(event: AgentEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function PUT(request: Request) {
  let payload: { toolCallId?: string; response?: string; sessionId?: string };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return Response.json({
      error: 'Invalid JSON payload.',
    }, {
      status: 400,
    });
  }

  const { toolCallId, response } = payload;

  if (!toolCallId || typeof toolCallId !== 'string') {
    return Response.json({
      error: 'toolCallId is required and must be a string.',
    }, {
      status: 400,
    });
  }

  if (response === undefined || response === null) {
    return Response.json({
      error: 'response is required.',
    }, {
      status: 400,
    });
  }

  const success = submitUserResponse(toolCallId, String(response));

  if (!success) {
    return Response.json({
      error: 'No pending ask_user request found with the provided toolCallId. It may have timed out or already been answered.',
    }, {
      status: 404,
    });
  }

  deletePendingAskUserQuestion(toolCallId);

  return Response.json({ success: true });
}
