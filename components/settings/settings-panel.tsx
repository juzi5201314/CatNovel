import { Badge } from '../ui/badge';
import { Panel } from '../ui/panel';
import { SectionLabel } from '../ui/section-label';

const settingCards = [
  {
    title: 'Book information',
    body: '标题、题材、简介、风格、基调、目标读者、叙事视角等 webnovel-first 字段。',
  },
  {
    title: 'World and rules',
    body: '世界观、力量体系、规则、势力、剧情规划与写作规则分区明确，不混入传统/剧本字段。',
  },
  {
    title: 'Locale & accessibility',
    body: 'zh / en / ru 与 focus ring / keyboard navigation 一起进入设置面，形成可审计的 UI surface。',
  },
];

export function SettingsPanel() {
  return (
    <Panel
      title="Settings containers"
      subtitle="设定与偏好都收纳在单主题面板里，后续只接 webnovel 契约。"
      badge={<Badge tone="neutral">Settings</Badge>}
    >
      <div className="settings-grid">
        {settingCards.map((card) => (
          <article key={card.title} className="settings-card">
            <SectionLabel>Webnovel only</SectionLabel>
            <h4>{card.title}</h4>
            <p>{card.body}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}
