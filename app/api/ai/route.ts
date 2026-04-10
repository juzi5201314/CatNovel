import { generateText } from '../../../lib/server/ai/generation-service';

export async function POST(request: Request) {
  const payload = await request.json();

  const result = generateText({
    profileId: payload.profileId ?? 'openai-default',
    modelId: payload.modelId ?? 'gpt-4.1',
    taskClass: payload.taskClass ?? '续写',
    prompt: payload.prompt ?? '',
    contextSelection: {
      chapter: payload.chapter ?? '',
      settings: payload.settings ?? [],
      summaries: payload.summaries ?? [],
      manualSelections: payload.manualSelections ?? [],
    },
  });

  return Response.json({
    route: 'ai-generation',
    streamed: result.streamed,
    ghostText: result.ghostText,
    tokenUsage: result.tokenUsage,
    contextPacket: result.contextPacket,
    output: result.text,
  });
}
