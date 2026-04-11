import type { ProviderProfileRecord, WorkspaceLocale } from '@/lib/contracts/workspace';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cx } from '@/lib/design/cx';

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
    <div className="p-4 space-y-4" id="ai-models">
      <span className="text-mono-label px-2">Models</span>
      <div className="grid grid-cols-1 gap-2">
        {providers.map((provider) => (
          <button
            key={provider.id}
            onClick={() => onSelectProfile(provider.id)}
            className={cx(
              "w-full text-left p-3 rounded-lg border transition-all",
              provider.id === activeProfileId
                ? "bg-background shadow-sm border-primary ring-1 ring-primary"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border-transparent"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-foreground">{provider.label}</span>
              <Badge tone={provider.enabled ? 'blue' : 'neutral'} className="text-[10px] px-1.5 py-0">
                {provider.enabled ? 'Active' : 'Standby'}
              </Badge>
            </div>
            <p className="text-[10px] truncate opacity-60">{provider.endpoint}</p>
            <div className="flex flex-wrap gap-1 mt-2">
               {provider.modelIds.slice(0, 3).map(m => (
                 <Badge key={m} tone="neutral" className="text-[9px] px-1 py-0">{m}</Badge>
               ))}
               {provider.modelIds.length > 3 && <span className="text-[9px] opacity-50">+{provider.modelIds.length - 3}</span>}
            </div>
          </button>
        ))}
      </div>

      <div className="pt-4 border-t space-y-2">
        <span className="text-[10px] uppercase font-semibold text-muted-foreground px-2">Add Custom Provider</span>
        <Input
          value={draftLabel}
          onChange={(e) => onDraftFieldChange('label', e.target.value)}
          placeholder="Provider Name"
          className="h-8 text-xs"
        />
        <Input
          value={draftEndpoint}
          onChange={(e) => onDraftFieldChange('endpoint', e.target.value)}
          placeholder="Endpoint URL"
          className="h-8 text-xs"
        />
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={onCreateProfile}>
          Add Provider
        </Button>
      </div>
    </div>
  );
}
