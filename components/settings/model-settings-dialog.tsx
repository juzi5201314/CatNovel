'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ActiveModelSelection, ProviderFamily, ProviderProfileRecord } from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { ActiveModelSelector } from './active-model-selector';
import { ProviderEditor } from './provider-editor';
import { ProviderList } from './provider-list';
import { cx } from '@/lib/design/cx';

export function ModelSettingsDialog({
  copy,
  providers,
  activeModel,
  onActiveModelChange,
  onProvidersChange,
  onClose,
}: {
  copy: AppMessages;
  providers: ProviderProfileRecord[];
  activeModel: ActiveModelSelection | null;
  onActiveModelChange: (selection: ActiveModelSelection) => void;
  onProvidersChange: () => void;
  onClose: () => void;
}) {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    activeModel?.profileId ?? providers[0]?.id ?? null,
  );

  const selectedProvider = providers.find((p) => p.id === selectedProviderId) ?? null;

  // Sync selected provider with active model on open
  useEffect(() => {
    if (activeModel?.profileId) {
      setSelectedProviderId(activeModel.profileId);
    }
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

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
      onProvidersChange();
    } catch {
      // silent
    }
  }, [onProvidersChange]);

  const handleDeleteProvider = useCallback(async () => {
    if (!selectedProviderId) return;
    try {
      await fetch(`/api/ai?profileId=${selectedProviderId}`, { method: 'DELETE' });

      // If the deleted provider was the active model, clear it
      if (activeModel?.profileId === selectedProviderId) {
        const nextProvider = providers.find((p) => p.id !== selectedProviderId);
        if (nextProvider) {
          onActiveModelChange({ profileId: nextProvider.id, modelId: nextProvider.modelIds[0] });
        }
      }

      setSelectedProviderId(providers.find((p) => p.id !== selectedProviderId)?.id ?? null);
      onProvidersChange();
    } catch {
      // silent
    }
  }, [selectedProviderId, activeModel, providers, onActiveModelChange, onProvidersChange]);

  const handleFieldChange = useCallback((_field: string, _value: string | boolean) => {
    onProvidersChange();
  }, [onProvidersChange]);

  return (
    <div className="settings-overlay">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">{copy.modelSettings}</h2>
          <ActiveModelSelector
            copy={copy}
            providers={providers}
            activeModel={activeModel}
            onChange={onActiveModelChange}
          />
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Two-column layout */}
      <div className="settings-layout">
        <div className="border-r overflow-hidden">
          <ProviderList
            copy={copy}
            providers={providers}
            selectedId={selectedProviderId}
            onSelect={setSelectedProviderId}
            onAdd={handleAddProvider}
          />
        </div>

        <div className="overflow-hidden">
          {selectedProvider ? (
            <ProviderEditor
              key={selectedProvider.id}
              copy={copy}
              provider={selectedProvider}
              onFieldChange={handleFieldChange}
              onDelete={handleDeleteProvider}
              onModelsChange={onProvidersChange}
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
