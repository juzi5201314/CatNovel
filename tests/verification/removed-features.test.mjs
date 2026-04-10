import test from 'node:test';
import assert from 'node:assert/strict';

import { RUNTIME_ROOTS, listExistingRoots, readTextFiles } from './helpers/repo.mjs';

const bannedPatterns = [
  /next-themes/i,
  /ThemeProvider/,
  /themeMode/i,
  /setTheme/i,
  /layoutMode/i,
  /setLayoutMode/i,
  /cloud\s*sync/i,
  /firebase/i,
  /supabase/i,
  /\blogin\b/i,
  /\bregister\b/i,
  /multi-account/i,
  /screenplay/i,
  /traditional mode/i,
  /electron/i,
  /autoUpdater/i,
  /desktop shell/i,
];

test('removed capability roots are absent from runtime code', () => {
  const existingRoots = listExistingRoots(RUNTIME_ROOTS);

  assert.ok(
    existingRoots.length > 0,
    '运行时代码目录尚未建立，无法验证删减能力是否真的不存在。',
  );

  const files = readTextFiles(existingRoots);
  const violations = [];

  for (const { relativeFilePath, content } of files) {
    for (const pattern of bannedPatterns) {
      if (pattern.test(relativeFilePath) || pattern.test(content)) {
        violations.push(`${relativeFilePath} => ${pattern}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `发现被需求明确删除的能力痕迹：\n${violations.join('\n')}`,
  );
});
