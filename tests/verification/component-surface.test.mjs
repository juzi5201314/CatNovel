import test from 'node:test';
import assert from 'node:assert/strict';

import { repoPathExists } from './helpers/repo.mjs';

test('component surface covers every workspace lane from the PRD', () => {
  const requiredComponentRoots = [
    'components/workspace',
    'components/editor',
    'components/ai',
    'components/settings',
    'components/snapshots',
    'components/onboarding',
    'components/ui',
  ];

  const missingRoots = requiredComponentRoots.filter(
    (entry) => !repoPathExists(entry),
  );

  assert.deepEqual(
    missingRoots,
    [],
    `PRD 对应的组件分区仍缺失：${missingRoots.join(', ')}`,
  );
});
