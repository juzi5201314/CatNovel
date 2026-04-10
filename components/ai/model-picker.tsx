import type { ProviderProfileRecord, WorkspaceLocale } from '@/lib/contracts/workspace';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { SectionLabel } from '../ui/section-label';
import { providerFamilyLabels, t } from '../workspace/workspace-data';

export function ModelPicker({
  locale,
  providers,
  activeProfileId,
  draftLabel,
  draftEndpoint,
  draftModels,
  onSelectProfile,
  onDraftFieldChange,
  onCreateProfile,
}: {
  locale: WorkspaceLocale;
  providers: ProviderProfileRecord[];
  activeProfileId: string | null;
  draftLabel: string;
  draftEndpoint: string;
  draftModels: string;
  onSelectProfile: (profileId: string) => void;
  onDraftFieldChange: (field: 'label' | 'endpoint' | 'models', value: string) => void;
  onCreateProfile: () => void;
}) {
  return (
    <div className="model-picker-grid" id="ai-models">
      {providers.map((provider) => (
        <article
          key={provider.id}
          className={[
            'model-card',
            provider.id === activeProfileId ? 'work-card--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <SectionLabel>{t(locale, providerFamilyLabels[provider.family])}</SectionLabel>
          <div className="meta-row">
            <strong>{provider.label}</strong>
            <Badge tone={provider.enabled ? 'default' : 'neutral'}>
              {provider.enabled ? 'enabled' : 'standby'}
            </Badge>
          </div>
          <p>{provider.endpoint}</p>
          <p>{provider.modelIds.join(', ')}</p>
          <Button variant="ghost" onClick={() => onSelectProfile(provider.id)}>
            {locale === 'zh' ? '选中模型源' : locale === 'en' ? 'Use profile' : 'Выбрать профиль'}
          </Button>
        </article>
      ))}

      <article className="model-card">
        <SectionLabel>
          {locale === 'zh' ? '新增 Provider' : locale === 'en' ? 'New provider' : 'Новый провайдер'}
        </SectionLabel>
        <Input
          value={draftLabel}
          onChange={(event) => onDraftFieldChange('label', event.target.value)}
          placeholder={locale === 'zh' ? 'Provider 名称' : locale === 'en' ? 'Provider label' : 'Название'}
        />
        <Input
          value={draftEndpoint}
          onChange={(event) => onDraftFieldChange('endpoint', event.target.value)}
          placeholder="https://..."
        />
        <Input
          value={draftModels}
          onChange={(event) => onDraftFieldChange('models', event.target.value)}
          placeholder={locale === 'zh' ? '模型列表，用逗号分隔' : locale === 'en' ? 'Model ids, comma-separated' : 'Модели через запятую'}
        />
        <Button variant="ghost" onClick={onCreateProfile}>
          {locale === 'zh' ? '创建自定义端点' : locale === 'en' ? 'Create custom endpoint' : 'Создать custom endpoint'}
        </Button>
      </article>
    </div>
  );
}
