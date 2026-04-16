'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ActiveModelSelection, ProviderProfileRecord } from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { ActiveModelSelector } from './active-model-selector';
import { ProviderEditor } from './provider-editor';
import { ProviderList } from './provider-list';

export function ModelSettingsDialog({
  copy,
  providers,
  activeModel,
  onActiveModelChangeAction,
  onProvidersChangeAction,
  onCloseAction,
}: {
  copy: AppMessages;
  providers: ProviderProfileRecord[];
  activeModel: ActiveModelSelection | null;
  onActiveModelChangeAction: (selection: ActiveModelSelection) => void;
  onProvidersChangeAction: () => void;
  onCloseAction: () => void;
}) {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const resolvedSelectedProviderId = selectedProviderId ?? activeModel?.profileId ?? providers[0]?.id ?? null;
  const selectedProvider = providers.find((p) => p.id === resolvedSelectedProviderId) ?? null;

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseAction();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCloseAction]);

  const handleAddProvider = useCallback(async () => {
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'create-profile',
          label: 'New Provider',
          family: 'openai-compatible',
          endpoint: 'https://api.openai.com/v1',
          apiKey: '',
          modelIds: ['gpt-4.1'],
        }),
      });
      const data = await res.json();
      if (data.profile?.id) {
        setSelectedProviderId(data.profile.id);
      }
      onProvidersChangeAction();
    } catch {
      // silent
    }
  }, [onProvidersChangeAction]);

  const handleDeleteProvider = useCallback(async () => {
    if (!selectedProviderId) return;
    try {
      await fetch(`/api/ai?profileId=${selectedProviderId}`, { method: 'DELETE' });

      // If the deleted provider was the active model, clear it
      if (activeModel?.profileId === selectedProviderId) {
        const nextProvider = providers.find((p) => p.id !== selectedProviderId);
        if (nextProvider) {
          onActiveModelChangeAction({ profileId: nextProvider.id, modelId: nextProvider.modelIds[0] });
        }
      }

      setSelectedProviderId(providers.find((p) => p.id !== selectedProviderId)?.id ?? null);
      onProvidersChangeAction();
    } catch {
      // silent
    }
  }, [activeModel, onActiveModelChangeAction, onProvidersChangeAction, providers, selectedProviderId]);

  const handleFieldChange = useCallback(() => {
    onProvidersChangeAction();
  }, [onProvidersChangeAction]);

  return (
    <div className="settings-overlay">
      <button
        onClick={onCloseAction}
        className="absolute top-4 right-4 z-[60] w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors bg-background/80 backdrop-blur-sm shadow-sm border"
        title="关闭 (Esc)"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>

      <div className="flex items-center px-6 py-4 border-b">
        <div className="flex items-center gap-4 pr-12">
          <h2 className="text-lg font-semibold">{copy.modelSettings}</h2>
          <ActiveModelSelector
            copy={copy}
            providers={providers}
            activeModel={activeModel}
            onChangeAction={onActiveModelChangeAction}
          />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="settings-layout">
        <div className="border-r overflow-hidden">
          <ProviderList
            copy={copy}
            providers={providers}
            selectedId={resolvedSelectedProviderId}
            onSelectAction={setSelectedProviderId}
            onAddAction={handleAddProvider}
          />
        </div>

        <div className="overflow-hidden">
          {selectedProvider ? (
            <ProviderEditor
              key={selectedProvider.id}
              copy={copy}
              provider={selectedProvider}
              activeModel={activeModel}
              onFieldChangeAction={handleFieldChange}
              onDeleteAction={handleDeleteProvider}
              onModelsChangeAction={onProvidersChangeAction}
              onSetAsActiveAction={(modelId: string) => onActiveModelChangeAction({ profileId: selectedProvider.id, modelId })}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {copy.noProviderSelected}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
