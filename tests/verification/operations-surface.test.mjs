import test from 'node:test';
import assert from 'node:assert/strict';

import { repoPathExists, walkFiles } from './helpers/repo.mjs';

test('operations surface includes health/readiness and backup/restore entry points', () => {
  const candidateRoots = ['app', 'scripts', 'docs'];
  const existingRoots = candidateRoots.filter((entry) => repoPathExists(entry));

  assert.ok(
    existingRoots.length > 0,
    '缺少 app/scripts/docs 基础目录，无法验证部署与运维交付面。',
  );

  const fileList = existingRoots.flatMap((entry) => walkFiles(entry)).join('\n');

  assert.match(
    fileList,
    /(health|readiness)/i,
    '缺少 health/readiness 相关入口点。',
  );

  assert.match(
    fileList,
    /(backup|restore)/i,
    '缺少 backup/restore 相关入口点。',
  );
});
