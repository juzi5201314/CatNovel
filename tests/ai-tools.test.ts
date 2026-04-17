import assert from 'node:assert/strict';
import test from 'node:test';

import { validateToolCall as validatePiToolCall } from '@mariozechner/pi-ai';

import { closeDatabase } from '../db/client.ts';

function setupMemoryDatabase() {
  closeDatabase();
  process.env.CATNOVEL_DB_MEMORY = 'true';
  delete process.env.CATNOVEL_DATA_DIR;
  delete process.env.CATNOVEL_DB_FILE;
}

function buildToolCall(name: string, args: Record<string, unknown>) {
  return {
    type: 'toolCall' as const,
    id: `${name}-call`,
    name,
    arguments: args,
  };
}

test('tool registry validates and executes writing tools', async () => {
  setupMemoryDatabase();

  const [
    { createWork },
    { createVolume },
    { createChapter },
    { createSettingNode },
    { deriveChapterMetrics },
    { toolRegistry, tools, validateToolCall },
  ] = await Promise.all([
    import('../lib/server/repositories/work-repository.ts'),
    import('../lib/server/repositories/volume-repository.ts'),
    import('../lib/server/repositories/chapter-repository.ts'),
    import('../lib/server/repositories/settings-repository.ts'),
    import('../lib/server/services/workspace-metrics.ts'),
    import('../lib/server/ai/tools/index.ts'),
  ]);

  try {
    const work = createWork({
      title: '工具测试作品',
      locale: 'zh',
      synopsis: '用于验证 AI 工具。',
    });
    const volume = createVolume({
      workId: work.id,
      title: '第一卷',
    });
    const chapterMetrics = deriveChapterMetrics(
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"风吹过空城，主角听见远处钟声。"}]}]}',
    );
    const chapter = createChapter({
      workId: work.id,
      volumeId: volume.id,
      title: '第一章',
      bodyJson:
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"风吹过空城，主角听见远处钟声。"}]}]}',
      plaintext: chapterMetrics.plaintext,
      excerpt: chapterMetrics.excerpt,
      wordCount: chapterMetrics.wordCount,
      characterCount: chapterMetrics.characterCount,
      readingMinutes: chapterMetrics.readingMinutes,
    });

    createSettingNode({
      workId: work.id,
      nodeType: 'character',
      title: '林雾',
      payloadJson: JSON.stringify({
        schemaVersion: 1,
        summary: '一名善于追踪线索的调查员。',
      }),
    });

    const readCall = buildToolCall('read_chapter', { chapterId: chapter.id });
    const validatedArgs = validatePiToolCall(tools, readCall) as { chapterId: string };
    assert.equal(validatedArgs.chapterId, chapter.id);

    const validatedCall = validateToolCall(readCall);
    assert.equal(validatedCall.tool.name, 'read_chapter');
    assert.equal((validatedCall.args as { chapterId: string }).chapterId, chapter.id);

    const chapterResult = await toolRegistry.execute(readCall);
    assert.equal((chapterResult as { id: string }).id, chapter.id);

    const searchResult = await toolRegistry.execute(
      buildToolCall('search_characters', {
        workId: work.id,
        query: '调查员',
      }),
    );
    const matches = (searchResult as { matches: Array<{ title: string }> }).matches;
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.title, '林雾');

    const suggestionResult = await toolRegistry.execute(
      buildToolCall('apply_suggestion', {
        chapterId: chapter.id,
        suggestion: '他决定沿着钟声继续前进。',
      }),
    );

    assert.match(
      (suggestionResult as { plaintext: string }).plaintext,
      /他决定沿着钟声继续前进。/,
    );
  } finally {
    closeDatabase();
  }
});
