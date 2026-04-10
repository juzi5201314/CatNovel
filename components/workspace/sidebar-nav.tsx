import { Badge } from '../ui/badge';
import { Panel } from '../ui/panel';
import { SectionLabel } from '../ui/section-label';

const navigationCards = [
  {
    title: '作品结构',
    body: '左栏为分卷、章节与检索入口预留稳定锚点，不再承载 layout mode 或 visual switch。',
    meta: 'Tree + search + chapter actions',
  },
  {
    title: '上下文选择',
    body: '角色、地点、世界观、剧情、规则会在 lane-3 / lane-4 接入这里，不打断写作主流。',
    meta: 'Settings context hooks',
  },
  {
    title: '运维状态',
    body: '保存状态、最近快照、deployment readiness 提醒都收拢在单一 shell 语义下。',
    meta: 'Backup / restore / health',
  },
];

export function SidebarNav() {
  return (
    <Panel
      title="Workspace navigation"
      subtitle="单栏展示结构入口，不引入多模式切换。"
      badge={<Badge tone="neutral">Lane 2</Badge>}
    >
      <div className="nav-stack">
        {navigationCards.map((card) => (
          <article key={card.title} className="nav-item">
            <SectionLabel>{card.meta}</SectionLabel>
            <strong>{card.title}</strong>
            <p>{card.body}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}
