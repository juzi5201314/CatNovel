import test from 'node:test';
import assert from 'node:assert/strict';

import { repoPathExists } from './helpers/repo.mjs';

test('workspace skeleton matches PRD top-level shape', () => {
  const requiredPaths = [
    'app',
    'components',
    'db',
    'docs',
    'lib',
    'public',
    'tests',
  ];

  const missingPaths = requiredPaths.filter((entry) => !repoPathExists(entry));

  assert.deepEqual(
    missingPaths,
    [],
    `PRD 要求的顶层目录仍缺失：${missingPaths.join(', ')}`,
  );
});
