import type { SupportedLocale } from '../../lib/i18n/messages';

import { SectionLabel } from '../ui/section-label';

const workflowSteps: Record<
  SupportedLocale,
  Array<{
    key: string;
    title: string;
    body: string;
    className: string;
  }>
> = {
  zh: [
    {
      key: 'develop',
      title: 'Develop',
      body: '编辑区保持主视觉中心，容纳章节、分卷与 slash/bubble toolbars 的后续接入。',
      className: 'workflow-step workflow-step--blue',
    },
    {
      key: 'preview',
      title: 'Preview',
      body: '右侧 AI / settings / help 容器使用同一 shadow-border 语言，便于迭代对齐。',
      className: 'workflow-step workflow-step--pink',
    },
    {
      key: 'ship',
      title: 'Ship',
      body: '单主题、无 layout mode、无 theme switch，为 production cutover 直接留出界面面。',
      className: 'workflow-step workflow-step--red',
    },
  ],
  en: [
    {
      key: 'develop',
      title: 'Develop',
      body: 'The editor keeps the highest visual weight and leaves room for chapters, volumes, and slash/bubble interactions.',
      className: 'workflow-step workflow-step--blue',
    },
    {
      key: 'preview',
      title: 'Preview',
      body: 'AI, settings, and help stay on the same shadow-border language so later iterations align instead of drift.',
      className: 'workflow-step workflow-step--pink',
    },
    {
      key: 'ship',
      title: 'Ship',
      body: 'Single-theme, no layout mode, no theme switch—just a direct production cutover surface.',
      className: 'workflow-step workflow-step--red',
    },
  ],
  ru: [
    {
      key: 'develop',
      title: 'Develop',
      body: 'Редактор сохраняет главный визуальный вес и оставляет место для глав, томов и slash/bubble интеракций.',
      className: 'workflow-step workflow-step--blue',
    },
    {
      key: 'preview',
      title: 'Preview',
      body: 'AI, настройки и help держатся на одном языке shadow-border, чтобы следующие итерации не расползались.',
      className: 'workflow-step workflow-step--pink',
    },
    {
      key: 'ship',
      title: 'Ship',
      body: 'Одна тема, без layout mode и без theme switch — только прямой production cutover surface.',
      className: 'workflow-step workflow-step--red',
    },
  ],
};

export function WorkflowStrip({ locale }: { locale: SupportedLocale }) {
  return (
    <section className="workflow-strip" aria-label="workspace workflow">
      {workflowSteps[locale].map((step) => (
        <article key={step.key} className={step.className}>
          <SectionLabel>{step.title}</SectionLabel>
          <strong>{step.title} lane</strong>
          <p>{step.body}</p>
        </article>
      ))}
    </section>
  );
}
