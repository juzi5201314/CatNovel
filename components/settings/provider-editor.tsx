'use client';

import { useCallback, useState } from 'react';
import type { ProviderFamily, ProviderProfileRecord } from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cx } from '@/lib/design/cx';

const apiFormatOptions: { value: ProviderFamily; label: string }[] = [
  { value: 'openai-compatible', label: 'OpenAI Compatible (含 Ollama)' },
  { value: 'openai-responses', label: 'OpenAI Responses API' },
  { value: 'claude-native', label: 'Anthropic Claude' },
  { value: 'gemini-native', label: 'Google Gemini' },
];

interface PresetProvider {
  key: string;
  label: string;
  baseUrl: string;
  family: ProviderFamily;
  websiteUrl: string;
  hint?: string;
}

const presetProviders: PresetProvider[] = [
  { key: 'zhipu', label: '智谱AI (GLM)', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', family: 'openai-compatible', websiteUrl: 'https://open.bigmodel.cn' },
  { key: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', family: 'openai-compatible', websiteUrl: 'https://platform.deepseek.com' },
  { key: 'bailian', label: '阿里云百炼 (千问)', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', family: 'openai-compatible', websiteUrl: 'https://bailian.console.aliyun.com', hint: '支持OpenAI和Anthropic两种格式' },
  { key: 'volcengine', label: '火山引擎 (豆包)', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', family: 'openai-compatible', websiteUrl: 'https://console.volcengine.com', hint: '需在控制台创建推理接入点' },
  { key: 'moonshot', label: 'Moonshot (Kimi)', baseUrl: 'https://api.moonshot.cn/v1', family: 'openai-compatible', websiteUrl: 'https://platform.moonshot.cn' },
  { key: 'stepfun', label: '阶跃星辰 (Step)', baseUrl: 'https://api.stepfun.com/v1', family: 'openai-compatible', websiteUrl: 'https://platform.stepfun.com' },
  { key: 'yi', label: '零一万物 (Yi)', baseUrl: 'https://api.lingyiwanwu.com/v1', family: 'openai-compatible', websiteUrl: 'https://platform.lingyiwanwu.com' },
  { key: 'baichuan', label: '百川 (Baichuan)', baseUrl: 'https://api.baichuan-ai.com/v1', family: 'openai-compatible', websiteUrl: 'https://platform.baichuan-ai.com' },
  { key: 'hunyuan', label: '腾讯混元', baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1', family: 'openai-compatible', websiteUrl: 'https://cloud.tencent.com/product/hunyuan' },
  { key: 'baidu', label: '百度文心', baseUrl: 'https://qianfan.baidubce.com/v2', family: 'openai-compatible', websiteUrl: 'https://qianfan.cloud.baidu.com' },
  { key: 'minimax', label: 'MiniMax', baseUrl: 'https://api.minimax.chat/v1', family: 'openai-compatible', websiteUrl: 'https://platform.minimaxi.com' },
  { key: 'siliconflow', label: 'SiliconFlow (硅基流动)', baseUrl: 'https://api.siliconflow.cn/v1', family: 'openai-compatible', websiteUrl: 'https://siliconflow.cn' },
  { key: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', family: 'openai-compatible', websiteUrl: 'https://platform.openai.com' },
  { key: 'claude', label: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com', family: 'claude-native', websiteUrl: 'https://console.anthropic.com' },
  { key: 'gemini', label: 'Gemini (OpenAI兼容)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', family: 'openai-compatible', websiteUrl: 'https://aistudio.google.com' },
  { key: 'gemini-native', label: 'Gemini（原生格式）', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', family: 'gemini-native', websiteUrl: 'https://aistudio.google.com' },
  { key: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', family: 'openai-compatible', websiteUrl: 'https://console.groq.com' },
  { key: 'mistral', label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', family: 'openai-compatible', websiteUrl: 'https://console.mistral.ai' },
  { key: 'cohere', label: 'Cohere', baseUrl: 'https://api.cohere.com/v2', family: 'openai-compatible', websiteUrl: 'https://cohere.com' },
  { key: 'together', label: 'Together AI', baseUrl: 'https://api.together.xyz/v1', family: 'openai-compatible', websiteUrl: 'https://api.together.xyz' },
  { key: 'perplexity', label: 'Perplexity', baseUrl: 'https://api.perplexity.ai', family: 'openai-compatible', websiteUrl: 'https://www.perplexity.ai/settings' },
  { key: 'xai', label: 'xAI (Grok)', baseUrl: 'https://api.x.ai/v1', family: 'openai-compatible', websiteUrl: 'https://console.x.ai' },
  { key: 'cerebras', label: 'Cerebras', baseUrl: 'https://api.cerebras.ai/v1', family: 'openai-compatible', websiteUrl: 'https://cloud.cerebras.ai' },
  { key: 'github', label: 'GitHub Models', baseUrl: 'https://models.inference.ai.azure.com', family: 'openai-compatible', websiteUrl: 'https://github.com/marketplace/models' },
  { key: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', family: 'openai-compatible', websiteUrl: 'https://openrouter.ai' },
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
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{copy.providerLabel}</label>
          <Input
            value={localLabel}
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={() => handleBlur('label', localLabel)}
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{copy.providerFamily}</label>
          <select
            value={provider.family}
            onChange={(e) => {
              const value = e.target.value;
              const preset = presetProviders.find(p => p.key === value);
              if (preset) {
                handlePatch('endpoint', preset.baseUrl);
                handlePatch('family', preset.family);
                setLocalEndpoint(preset.baseUrl);
              } else {
                handlePatch('family', value as ProviderFamily);
              }
            }}
            className="input h-9 text-sm w-full appearance-none cursor-pointer"
          >
            <optgroup label="API 格式">
              {apiFormatOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </optgroup>
            <optgroup label="预设供应商">
              {presetProviders.map((preset) => (
                <option key={preset.key} value={preset.key}>{preset.label}</option>
              ))}
            </optgroup>
          </select>
          {(() => {
            const selectedPreset = presetProviders.find(p => p.family === provider.family && p.baseUrl === provider.endpoint);
            if (selectedPreset) {
              return (
                <div className="flex items-center gap-2 mt-1.5">
                  <a
                    href={selectedPreset.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15,3 21,3 21,9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    访问 {selectedPreset.label} 官网
                  </a>
                  {selectedPreset.hint && (
                    <span className="text-[10px] text-muted-foreground">({selectedPreset.hint})</span>
                  )}
                </div>
              );
            }
            return null;
          })()}
        </div>

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
