'use client';

import { useCallback, useState } from 'react';
import type { ProviderFamily, ProviderProfileRecord } from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cx } from '@/lib/design/cx';

const familyOptions: { value: ProviderFamily; label: string }[] = [
  { value: 'openai-compatible', label: 'OpenAI Compatible (含 Ollama)' },
  { value: 'claude-native', label: 'Anthropic Claude' },
  { value: 'gemini-native', label: 'Google Gemini' },
];

export function ProviderEditor({
  copy,
  provider,
  onFieldChange,
  onDelete,
  onModelsChange,
}: {
  copy: AppMessages;
  provider: ProviderProfileRecord;
  onFieldChange: (field: string, value: string | boolean) => void;
  onDelete: () => void;
  onModelsChange: () => void;
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftModelId, setDraftModelId] = useState('');
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handlePatch = useCallback(async (field: string, value: string | boolean) => {
    try {
      await fetch('/api/ai', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileId: provider.id, [field]: value }),
      });
      onFieldChange(field, value);
    } catch {
      // silent — optimistic update
    }
  }, [provider.id, onFieldChange]);

  const handleBlur = (field: string, localValue: string) => {
    const current = (provider as any)[field] as string;
    if (localValue !== current) {
      handlePatch(field, localValue);
    }
  };

  const handleRemoveModel = async (modelId: string) => {
    const newModelIds = provider.modelIds.filter((m) => m !== modelId);
    if (newModelIds.length === 0) return;
    await fetch('/api/ai', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profileId: provider.id, modelIds: newModelIds }),
    });
    onModelsChange();
  };

  const handleAddModel = async () => {
    const id = draftModelId.trim();
    if (!id || provider.modelIds.includes(id)) return;
    const newModelIds = [...provider.modelIds, id];
    await fetch('/api/ai', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profileId: provider.id, modelIds: newModelIds }),
    });
    setDraftModelId('');
    onModelsChange();
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    try {
      const res = await fetch('/api/ai/fetch-models', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileId: provider.id }),
      });
      const data = await res.json();
      if (data.error) {
        setTestStatus('failed');
        setTestMessage(`${copy.fetchFailed}: ${data.error}`);
        return;
      }
      const fetched = data.models as string[];
      const merged = Array.from(new Set([...provider.modelIds, ...fetched])).sort();
      await fetch('/api/ai', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileId: provider.id, modelIds: merged }),
      });
      onModelsChange();
    } catch (error) {
      setTestStatus('failed');
      setTestMessage(`${copy.fetchFailed}: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setFetchingModels(false);
    }
  };

  const handleTest = async () => {
    setTestStatus('running');
    setTestMessage('');
    try {
      const res = await fetch('/api/ai/test-model', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileId: provider.id, modelId: provider.modelIds[0] }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus('success');
        setTestMessage(`${copy.connectionSuccess} (${data.latencyMs}ms) — "${data.responseText}"`);
      } else {
        setTestStatus('failed');
        setTestMessage(`${copy.connectionFailed}: ${data.error}`);
      }
    } catch (error) {
      setTestStatus('failed');
      setTestMessage(`${copy.connectionFailed}: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  };

  const handleDeleteClick = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete();
    setConfirmDelete(false);
  };

  const [localLabel, setLocalLabel] = useState(provider.label);
  const [localEndpoint, setLocalEndpoint] = useState(provider.endpoint);
  const [localApiKey, setLocalApiKey] = useState(provider.apiKey);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-lg">
        {/* Label */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{copy.providerLabel}</label>
          <Input
            value={localLabel}
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={() => handleBlur('label', localLabel)}
            className="h-9 text-sm"
          />
        </div>

        {/* Family */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{copy.providerFamily}</label>
          <select
            value={provider.family}
            onChange={(e) => handlePatch('family', e.target.value)}
            className="input h-9 text-sm w-full appearance-none cursor-pointer"
          >
            {familyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Endpoint */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{copy.endpoint}</label>
          <Input
            value={localEndpoint}
            onChange={(e) => setLocalEndpoint(e.target.value)}
            onBlur={() => handleBlur('endpoint', localEndpoint)}
            placeholder="https://api.openai.com/v1"
            className="h-9 text-sm font-mono text-[12px]"
          />
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{copy.apiKey}</label>
          <div className="flex gap-2">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={localApiKey}
              onChange={(e) => setLocalApiKey(e.target.value)}
              onBlur={() => handleBlur('apiKey', localApiKey)}
              placeholder={copy.apiKeyPlaceholder}
              className="h-9 text-sm font-mono text-[12px] flex-1"
            />
            <Button variant="ghost" size="sm" className="h-9 px-3 text-xs shrink-0" onClick={() => setShowApiKey(!showApiKey)}>
              {showApiKey ? 'Hide' : 'Show'}
            </Button>
          </div>
        </div>

        {/* Enabled Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{copy.enabled}</label>
          <button
            onClick={() => handlePatch('enabled', !provider.enabled)}
            className={cx(
              "relative w-10 h-5 rounded-full transition-colors",
              provider.enabled ? "bg-primary" : "bg-muted-foreground/20",
            )}
          >
            <span className={cx(
              "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
              provider.enabled && "translate-x-5",
            )} />
          </button>
        </div>

        {/* Models */}
        <div className="space-y-3 pt-2 border-t">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Models</label>

          {provider.modelIds.length > 0 ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={provider.modelIds[0]}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const reorderedIds = [selectedId, ...provider.modelIds.filter(m => m !== selectedId)];
                    fetch('/api/ai', {
                      method: 'PATCH',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ profileId: provider.id, modelIds: reorderedIds }),
                    }).then(() => onModelsChange());
                  }}
                  className="input h-9 text-sm w-full appearance-none cursor-pointer"
                >
                  {provider.modelIds.map((modelId) => (
                    <option key={modelId} value={modelId}>{modelId}</option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 text-xs shrink-0 text-muted-foreground hover:text-red-600"
                  onClick={() => handleRemoveModel(provider.modelIds[0])}
                  disabled={provider.modelIds.length <= 1}
                  title={provider.modelIds.length <= 1 ? copy.noModels : `${provider.modelIds.length} models`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/60">
                {provider.modelIds.length} models
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground opacity-60">{copy.noModels}</p>
          )}

          {/* Add model ID */}
          <div className="flex gap-2">
            <Input
              value={draftModelId}
              onChange={(e) => setDraftModelId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddModel()}
              placeholder={copy.modelIdPlaceholder}
              className="h-8 text-xs flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={handleAddModel}
              disabled={!draftModelId.trim() || provider.modelIds.includes(draftModelId.trim())}
            >
              {copy.addModelId}
            </Button>
          </div>

          {/* Fetch from API */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={handleFetchModels}
            disabled={fetchingModels}
          >
            {fetchingModels ? copy.fetchingModels : copy.fetchModels}
          </Button>
        </div>

        {/* Test Connection */}
        <div className="space-y-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className={cx("w-full h-9 text-xs", testStatus === 'success' && "border-green-500/50 text-green-700", testStatus === 'failed' && "border-red-500/50 text-red-700")}
            onClick={handleTest}
            disabled={testStatus === 'running' || provider.modelIds.length === 0}
          >
            {testStatus === 'running' ? copy.testRunning : copy.testConnection}
          </Button>

          {testMessage && (
            <p className={cx("text-[11px] px-1", testStatus === 'success' ? "text-green-600" : testStatus === 'failed' ? "text-red-600" : "text-muted-foreground")}>
              {testMessage}
            </p>
          )}
        </div>

        {/* Delete Provider */}
        <div className="pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            className={cx(
              "w-full h-9 text-xs",
              confirmDelete
                ? "text-white bg-red-500 hover:bg-red-600"
                : "text-red-600 hover:text-red-700 hover:bg-red-50"
            )}
            onClick={handleDeleteClick}
            onBlur={() => setConfirmDelete(false)}
          >
            {confirmDelete ? copy.deleteProviderConfirm : copy.deleteProvider}
          </Button>
        </div>
      </div>
    </div>
  );
}
