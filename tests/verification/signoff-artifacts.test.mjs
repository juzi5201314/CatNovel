import test from 'node:test';
import assert from 'node:assert/strict';

import { repoPathExists } from './helpers/repo.mjs';

test('signoff artifacts required by the test spec all exist', () => {
  const requiredArtifacts = [
    'docs/feature-matrix.md',
    'docs/verification/feature-gap-report.md',
    'docs/verification/manual-test-script.md',
    'docs/verification/database-consistency.md',
    'docs/verification/design-audit.md',
    'docs/verification/deployment-readiness.md',
    'docs/verification/signoff-checklist.md',
  ];

  const missingArtifacts = requiredArtifacts.filter(
    (entry) => !repoPathExists(entry),
  );

  assert.deepEqual(
    missingArtifacts,
    [],
    `test-spec 要求的 signoff artifacts 缺失：${missingArtifacts.join(', ')}`,
  );
});
