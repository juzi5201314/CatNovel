import { Badge } from '../ui/badge';
import { SectionLabel } from '../ui/section-label';

const modelGroups = [
  {
    name: 'OpenAI-compatible',
    description:
      '为 OpenAI-compatible、Moonshot、SiliconFlow 等 provider 预留统一模型选择 surface。',
    tone: 'neutral' as const,
  },
  {
    name: 'Gemini-native',
    description:
      '保留 Gemini 原生拉模与 embed-only 列表位，但不把 provider 逻辑塞进组件本身。',
    tone: 'default' as const,
  },
  {
    name: 'Claude-native',
    description:
      'Anthropic / Claude 模型能力单列，方便后续 worker-2 对接真实 provider 数据。',
    tone: 'red' as const,
  },
];

export function ModelPicker() {
  return (
    <div className="model-picker-grid">
      {modelGroups.map((group) => (
        <article key={group.name} className="model-card">
          <SectionLabel>Model picker</SectionLabel>
          <div className="meta-row">
            <strong>{group.name}</strong>
            <Badge tone={group.tone}>{group.tone === 'red' ? 'native' : 'ready'}</Badge>
          </div>
          <p>{group.description}</p>
        </article>
      ))}
    </div>
  );
}
