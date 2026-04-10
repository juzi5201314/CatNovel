import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readTextFiles,
  repoPathExists,
  walkFiles,
} from './helpers/repo.mjs';

test('lane-4 import/export/snapshot surface exists with the PRD target paths', () => {
  const requiredEntries = [
    'app/api/import/parse-file/route.ts',
    'app/api/export',
    'app/api/snapshots',
    'lib/server/importers',
    'lib/server/exporters',
  ];

  const missingEntries = requiredEntries.filter((entry) => !repoPathExists(entry));

  assert.deepEqual(
    missingEntries,
    [],
    `Import/export/snapshot lane 缺少 PRD 指定路径：${missingEntries.join(', ')}`,
  );
});

test('data lifecycle coverage exposes required formats and snapshot verbs', () => {
  const fixtureFiles = walkFiles('tests/fixtures').join('\n');
  const requiredImportExtensions = ['txt', 'md', 'epub', 'docx', 'doc', 'pdf'];

  for (const extension of requiredImportExtensions) {
    assert.match(
      fixtureFiles,
      new RegExp(`\\.${extension}(\\n|$)`, 'i'),
      `tests/fixtures 缺少 ${extension} 导入样例。`,
    );
  }

  const lifecycleRoots = [
    'app/api/import',
    'app/api/export',
    'app/api/snapshots',
    'lib/server/importers',
    'lib/server/exporters',
  ].filter((entry) => repoPathExists(entry));

  assert.ok(
    lifecycleRoots.length > 0,
    '数据生命周期目录尚未落地，无法验证格式覆盖与快照动作。',
  );

  const textCorpus = readTextFiles(lifecycleRoots)
    .map(({ content }) => content)
    .join('\n');

  const requiredMarkers = [
    { label: 'project JSON export', pattern: /json/i },
    { label: 'TXT support', pattern: /txt/i },
    { label: 'Markdown support', pattern: /\bmd\b|markdown/i },
    { label: 'EPUB support', pattern: /epub/i },
    { label: 'DOCX support', pattern: /docx/i },
    { label: 'DOC support', pattern: /\bdoc\b/i },
    { label: 'PDF support', pattern: /pdf/i },
    { label: 'create snapshot', pattern: /create/i },
    { label: 'list snapshots', pattern: /list/i },
    { label: 'restore snapshot', pattern: /restore/i },
    { label: 'delete snapshot', pattern: /delete/i },
  ];

  for (const { label, pattern } of requiredMarkers) {
    assert.match(
      textCorpus,
      pattern,
      `数据生命周期 surface 未暴露必需能力标记：${label}`,
    );
  }
});
