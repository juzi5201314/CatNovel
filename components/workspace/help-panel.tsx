import type { AppMessages, SupportedLocale } from '../../lib/i18n/messages';

import { Badge } from '../ui/badge';
import { Panel } from '../ui/panel';
import { SectionLabel } from '../ui/section-label';

const helpTopics: Record<SupportedLocale, Array<{ title: string; body: string }>> = {
  zh: [
    {
      title: '快捷键层',
      body: '把 slash command、bubble menu、搜索高亮、章节跳转的文案入口固定成单独 help surface。',
    },
    {
      title: '写作流程',
      body: '继续写 / 改写 / 润色 / 扩写 / 自由对话 会在这里给出逐项说明，避免用户迷路。',
    },
    {
      title: '运维提示',
      body: '备份、恢复、健康检查、readiness 都有明确入口，不再藏在外部文档里。',
    },
  ],
  en: [
    {
      title: 'Shortcut layer',
      body: 'Keep slash commands, bubble controls, search highlight, and chapter jumps in a dedicated help surface.',
    },
    {
      title: 'Writing flow',
      body: 'Continue / rewrite / polish / expand / free chat are spelled out so the user never guesses the next move.',
    },
    {
      title: 'Operations hints',
      body: 'Backup, restore, health, and readiness stay visible instead of hiding in external docs.',
    },
  ],
  ru: [
    {
      title: 'Слой шорткатов',
      body: 'Slash-команды, bubble-контролы, подсветка поиска и прыжки по главам собраны в отдельной help-поверхности.',
    },
    {
      title: 'Писательский поток',
      body: 'Continue / rewrite / polish / expand / free chat расписаны явно, чтобы пользователь не гадал о следующем шаге.',
    },
    {
      title: 'Операционные подсказки',
      body: 'Backup, restore, health и readiness остаются видимыми, а не прячутся во внешней документации.',
    },
  ],
};

export function HelpPanel({
  locale,
  copy,
}: {
  locale: SupportedLocale;
  copy: AppMessages;
}) {
  return (
    <Panel
      id="help-panel"
      title={copy.helpLabel}
      subtitle="帮助容器作为长期存在的右栏 surface，而不是模糊弹窗。"
      badge={<Badge tone="neutral">Help</Badge>}
    >
      <div className="task-stack">
        {helpTopics[locale].map((topic) => (
          <article key={topic.title} className="help-card">
            <SectionLabel>Guidance</SectionLabel>
            <strong>{topic.title}</strong>
            <p>{topic.body}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}
