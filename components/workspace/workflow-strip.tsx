import { SectionLabel } from '../ui/section-label';

const workflowSteps = [
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
];

export function WorkflowStrip() {
  return (
    <section className="workflow-strip" aria-label="workspace workflow">
      {workflowSteps.map((step) => (
        <article key={step.key} className={step.className}>
          <SectionLabel>{step.title}</SectionLabel>
          <strong>{step.title} lane</strong>
          <p>{step.body}</p>
        </article>
      ))}
    </section>
  );
}
