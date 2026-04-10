import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readTextFiles,
  repoPathExists,
  resolveFromRepo,
} from './helpers/repo.mjs';

test('lane-4 AI runtime surface exists with the PRD target files', () => {
  const requiredEntries = [
    'app/api/ai/route.ts',
    'app/api/ai/models/route.ts',
    'lib/server/ai/provider-registry.ts',
    'lib/server/ai/generation-service.ts',
    'lib/server/ai/context-engine.ts',
  ];

  const missingEntries = requiredEntries.filter((entry) => !repoPathExists(entry));

  assert.deepEqual(
    missingEntries,
    [],
    `AI lane 缺少 PRD 指定文件：${missingEntries.join(', ')}`,
  );
});

test('AI runtime surface advertises required provider families and workflows', () => {
  const surfaceRoots = ['app/api/ai', 'lib/server/ai', 'components/ai'];
  const existingRoots = surfaceRoots.filter((entry) => repoPathExists(entry));

  assert.ok(
    existingRoots.length > 0,
    'AI 运行时目录尚未落地，无法验证 provider family 与 workflow 覆盖。',
  );

  const textCorpus = readTextFiles(existingRoots)
    .map(({ relativeFilePath, content }) => `FILE:${resolveFromRepo(relativeFilePath)}\n${content}`)
    .join('\n');

  const requiredMarkers = [
    { label: 'OpenAI-compatible', pattern: /openai/i },
    { label: 'Gemini-native', pattern: /gemini/i },
    { label: 'Claude-native', pattern: /claude/i },
    { label: 'custom endpoint', pattern: /custom/i },
    { label: 'ghost text', pattern: /ghost/i },
    { label: 'token usage', pattern: /token/i },
    { label: 'context engine', pattern: /context/i },
  ];

  for (const { label, pattern } of requiredMarkers) {
    assert.match(
      textCorpus,
      pattern,
      `AI surface 未暴露必需能力标记：${label}`,
    );
  }
});
