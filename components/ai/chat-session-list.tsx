import type { SupportedLocale } from '../../lib/i18n/messages';

import { Badge } from '../ui/badge';
import { SectionLabel } from '../ui/section-label';
import { type LocaleText, t } from '../workspace/workspace-data';

const chatSessions = [
  {
    title: {
      zh: '剧情打磨',
      en: 'Plot shaping',
      ru: 'Шлифовка сюжета',
    } satisfies LocaleText,
    summary: {
      zh: '聚焦冲突升级与章节节奏，保留最近一次 ghost text 接受位。',
      en: 'Focuses on escalating conflict and chapter rhythm while keeping the latest ghost-text acceptance slot.',
      ru: 'Фокус на наращивании конфликта и ритме главы с сохранением последнего ghost-text acceptance слота.',
    } satisfies LocaleText,
  },
  {
    title: {
      zh: '设定校对',
      en: 'Setting review',
      ru: 'Проверка сеттинга',
    } satisfies LocaleText,
    summary: {
      zh: '检查角色境界、势力关系与世界规则是否自洽。',
      en: 'Checks character tiers, faction relations, and world rules for consistency.',
      ru: 'Проверяет уровни персонажей, отношения фракций и правила мира на согласованность.',
    } satisfies LocaleText,
  },
  {
    title: {
      zh: '自由对话',
      en: 'Free chat',
      ru: 'Свободный чат',
    } satisfies LocaleText,
    summary: {
      zh: '给作者一个不脱离正文上下文的 sidecar conversation surface。',
      en: 'Gives the author a sidecar conversation surface that never leaves the chapter context.',
      ru: 'Даёт автору sidecar conversation surface, не отрываясь от контекста главы.',
    } satisfies LocaleText,
  },
];

export function ChatSessionList({ locale }: { locale: SupportedLocale }) {
  return (
    <div className="chat-session-list" id="ai-sessions">
      {chatSessions.map((session, index) => (
        <article key={index} className="chat-session-card">
          <div className="meta-row">
            <SectionLabel>{`Session 0${index + 1}`}</SectionLabel>
            <Badge tone="neutral">persisted</Badge>
          </div>
          <strong>{t(locale, session.title)}</strong>
          <p>{t(locale, session.summary)}</p>
        </article>
      ))}
    </div>
  );
}
