import { Badge } from '../ui/badge';
import { Panel } from '../ui/panel';
import { SectionLabel } from '../ui/section-label';
import type { SupportedLocale } from '../../lib/i18n/messages';

const onboardingSteps: Record<
  SupportedLocale,
  Array<{ title: string; body: string }>
> = {
  zh: [
    {
      title: '创建作品信息与网文设定树',
      body: '先定义作品标题、题材与世界规则，再决定章节节奏。',
    },
    {
      title: '确认章节结构与写作目标',
      body: '把主线章节与支线 work 分开，避免写作时上下文噪音过大。',
    },
    {
      title: '接通 AI provider 并预热上下文',
      body: '模型列表、会话列表与快照入口已经在当前 route 中连通。',
    },
  ],
  en: [
    {
      title: 'Create book info and the webnovel settings tree',
      body: 'Define title, genre, and world rules before shaping chapter pace.',
    },
    {
      title: 'Confirm chapter structure and writing intent',
      body: 'Separate the main serial from side works so context noise stays low.',
    },
    {
      title: 'Connect an AI provider and warm the context',
      body: 'Model picker, chat sessions, and snapshots already share the same route anchors.',
    },
  ],
  ru: [
    {
      title: 'Создайте данные книги и дерево веб-новеллы',
      body: 'Сначала зафиксируйте название, жанр и правила мира, а потом стройте ритм глав.',
    },
    {
      title: 'Подтвердите структуру глав и авторское намерение',
      body: 'Разведите основную серию и побочные работы, чтобы не шуметь контекстом.',
    },
    {
      title: 'Подключите AI-провайдера и прогрейте контекст',
      body: 'Выбор модели, список сессий и снимки уже связаны якорями текущего route.',
    },
  ],
};

export function OnboardingCard({ locale }: { locale: SupportedLocale }) {
  return (
    <Panel
      title="Onboarding flow"
      subtitle="新手引导改为内嵌 surface，不依赖 theme 或桌面模式。"
      badge={<Badge>3-step</Badge>}
    >
      <div className="task-stack">
        {onboardingSteps[locale].map((step, index) => (
          <article key={step.title} className="task-card">
            <SectionLabel>{`Step 0${index + 1}`}</SectionLabel>
            <strong>{step.title}</strong>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}
