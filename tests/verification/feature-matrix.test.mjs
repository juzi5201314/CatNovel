import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { resolveFromRepo } from './helpers/repo.mjs';

const featureMatrixPath = resolveFromRepo('docs', 'feature-matrix.md');

test('feature matrix exists and exposes required audit fields', () => {
  assert.ok(
    fs.existsSync(featureMatrixPath),
    'docs/feature-matrix.md 必须存在，作为 capability gate 的唯一入口。',
  );

  const featureMatrix = fs.readFileSync(featureMatrixPath, 'utf8');
  const requiredMarkers = [
    'source evidence',
    'target owner',
    'status',
    'verification evidence',
  ];

  for (const marker of requiredMarkers) {
    assert.match(
      featureMatrix,
      new RegExp(marker, 'i'),
      `feature matrix 缺少必填字段：${marker}`,
    );
  }
});

test('feature matrix does not use forbidden completion states', () => {
  assert.ok(
    fs.existsSync(featureMatrixPath),
    'docs/feature-matrix.md 缺失，无法执行状态闸门校验。',
  );

  const featureMatrix = fs.readFileSync(featureMatrixPath, 'utf8');
  const forbiddenStatuses = [
    'todo',
    'deferred',
    'partially implemented',
    'implicitly covered',
    'unknown',
  ];

  for (const status of forbiddenStatuses) {
    assert.doesNotMatch(
      featureMatrix,
      new RegExp(`status\\s*[:|]\\s*${status}`, 'i'),
      `feature matrix 仍包含被禁止的状态：${status}`,
    );
  }
});
