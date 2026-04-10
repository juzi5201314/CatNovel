import test from 'node:test';
import assert from 'node:assert/strict';

import { repoPathExists, walkFiles } from './helpers/repo.mjs';

test('i18n surface includes zh/en/ru locale artifacts', () => {
  assert.ok(repoPathExists('lib', 'i18n'), '缺少 lib/i18n，无法承载多语言实现。');

  const localeHints = walkFiles('lib/i18n').join('\n');
  const requiredLocales = ['zh', 'en', 'ru'];

  for (const locale of requiredLocales) {
    assert.match(
      localeHints,
      new RegExp(`(^|[^a-z])${locale}([^a-z]|$)`, 'i'),
      `lib/i18n 中缺少 ${locale} 语言资源痕迹。`,
    );
  }
});
