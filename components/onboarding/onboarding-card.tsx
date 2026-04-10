import { Badge } from '../ui/badge';
import { Panel } from '../ui/panel';
import { SectionLabel } from '../ui/section-label';

const onboardingSteps = [
  '创建作品信息与网文设定树',
  '确认章节结构与写作目标',
  '接通 AI provider 并预热上下文',
];

export function OnboardingCard() {
  return (
    <Panel
      title="Onboarding flow"
      subtitle="新手引导改为内嵌 surface，不依赖 theme 或桌面模式。"
      badge={<Badge>3-step</Badge>}
    >
      <div className="task-stack">
        {onboardingSteps.map((step, index) => (
          <article key={step} className="task-card">
            <SectionLabel>{`Step 0${index + 1}`}</SectionLabel>
            <strong>{step}</strong>
            <p>
              以单用户、本地优先、webnovel-only 的约束给出明确起步路径。
            </p>
          </article>
        ))}
      </div>
    </Panel>
  );
}
