import test from 'node:test';
import assert from 'node:assert/strict';

import { repoPathExists } from './helpers/repo.mjs';

test('server surface includes the required API and persistence entry points', () => {
  const requiredEntries = [
    'app/api/ai',
    'app/api/bootstrap',
    'app/api/export',
    'app/api/import',
    'app/api/snapshots',
    'db/client.ts',
    'db/schema.ts',
    'db/migrations',
    'lib/server/repositories',
    'lib/server/services',
    'lib/server/importers',
    'lib/server/exporters',
    'lib/server/ai',
  ];

  const missingEntries = requiredEntries.filter((entry) => !repoPathExists(entry));

  assert.deepEqual(
    missingEntries,
    [],
    `PRD 定义的服务面缺失：${missingEntries.join(', ')}`,
  );
});
