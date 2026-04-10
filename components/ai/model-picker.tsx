import type { SupportedLocale } from '../../lib/i18n/messages';

import { Badge } from '../ui/badge';
import { SectionLabel } from '../ui/section-label';
import { type LocaleText, t } from '../workspace/workspace-data';

const modelGroups = [
  {
    name: {
      zh: 'OpenAI-compatible',
      en: 'OpenAI-compatible',
      ru: 'OpenAI-compatible',
    } satisfies LocaleText,
    description: {
      zh: '为 OpenAI-compatible、Moonshot、SiliconFlow 等 provider 预留统一模型选择 surface。',
      en: 'A shared picker surface for OpenAI-compatible, Moonshot, and SiliconFlow-style providers.',
      ru: 'Общая поверхность выбора модели для OpenAI-compatible, Moonshot и SiliconFlow-подобных провайдеров.',
    } satisfies LocaleText,
    tone: 'neutral' as const,
  },
  {
    name: {
      zh: 'Gemini-native',
      en: 'Gemini-native',
      ru: 'Gemini-native',
    } satisfies LocaleText,
    description: {
      zh: '保留 Gemini 原生拉模与 embed-only 列表位，但不把 provider 逻辑塞进组件本身。',
      en: 'Keeps native Gemini discovery and embed-only slots visible without pushing provider logic into the component.',
      ru: 'Оставляет видимыми native Gemini discovery и embed-only слоты, не таща логику провайдера внутрь компонента.',
    } satisfies LocaleText,
    tone: 'default' as const,
  },
  {
    name: {
      zh: 'Claude-native',
      en: 'Claude-native',
      ru: 'Claude-native',
    } satisfies LocaleText,
    description: {
      zh: 'Anthropic / Claude 模型能力单列，方便后续 worker-2 对接真实 provider 数据。',
      en: 'Separates Anthropic / Claude capability rows so worker-2 can wire real provider data later.',
      ru: 'Выносит возможности Anthropic / Claude в отдельные строки, чтобы worker-2 позже подключил реальные данные.',
    } satisfies LocaleText,
    tone: 'red' as const,
  },
];

export function ModelPicker({ locale }: { locale: SupportedLocale }) {
  return (
    <div className="model-picker-grid" id="ai-models">
      {modelGroups.map((group) => (
        <article key={group.tone} className="model-card">
          <SectionLabel>Model picker</SectionLabel>
          <div className="meta-row">
            <strong>{t(locale, group.name)}</strong>
            <Badge tone={group.tone}>{group.tone === 'red' ? 'native' : 'ready'}</Badge>
          </div>
          <p>{t(locale, group.description)}</p>
        </article>
      ))}
    </div>
  );
}
