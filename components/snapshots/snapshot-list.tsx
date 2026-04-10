import type { SupportedLocale } from '../../lib/i18n/messages';

import { SectionLabel } from '../ui/section-label';
import { type LocaleText, t } from '../workspace/workspace-data';

const snapshots = [
  {
    title: {
      zh: '导入前保护点',
      en: 'Pre-import safeguard',
      ru: 'Контрольная точка перед импортом',
    } satisfies LocaleText,
    meta: {
      zh: 'TXT / EPUB 导入前',
      en: 'Before TXT / EPUB ingest',
      ru: 'Перед TXT / EPUB импортом',
    } satisfies LocaleText,
  },
  {
    title: {
      zh: '章节回滚检查点',
      en: 'Chapter rollback checkpoint',
      ru: 'Контрольная точка отката главы',
    } satisfies LocaleText,
    meta: {
      zh: '破坏性改写前',
      en: 'Before destructive rewrite',
      ru: 'Перед разрушительным переписыванием',
    } satisfies LocaleText,
  },
  {
    title: {
      zh: '发布演练快照',
      en: 'Release rehearsal',
      ru: 'Снимок перед релизной репетицией',
    } satisfies LocaleText,
    meta: {
      zh: '备份 / 恢复演练前',
      en: 'Before backup / restore drill',
      ru: 'Перед прогоном backup / restore',
    } satisfies LocaleText,
  },
];

export function SnapshotList({ locale, chapterTitle }: { locale: SupportedLocale; chapterTitle: string }) {
  return (
    <div className="snapshot-list">
      {snapshots.map((snapshot) => (
        <article key={t(locale, snapshot.title)} className="snapshot-card">
          <SectionLabel>{t(locale, snapshot.meta)}</SectionLabel>
          <strong>{t(locale, snapshot.title)}</strong>
          <p>
            当前与 {chapterTitle} 绑定；后续将接入 create / list / restore / delete 与审计记录。
          </p>
        </article>
      ))}
    </div>
  );
}
