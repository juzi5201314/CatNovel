"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  type ModelPreset,
  type PresetApiFormat,
  type PresetPurpose,
  type ProviderConfig,
  type ThinkingBudget,
  requestJson,
} from "@/components/settings/types";

type PresetForm = {
  providerId: string;
  purpose: PresetPurpose;
  apiFormat: PresetApiFormat;
  modelId: string;
  temperature: string;
  maxTokens: string;
  thinkingType: "none" | "effort" | "tokens";
  thinkingEffort: "low" | "medium" | "high";
  thinkingTokens: string;
};

type ModelPresetsPanelProps = {
  providers: ProviderConfig[];
  onPresetsChange: (presets: ModelPreset[]) => void;
};

function toThinkingBudget(form: PresetForm): ThinkingBudget | undefined {
  if (form.thinkingType === "effort") {
    return { type: "effort", effort: form.thinkingEffort };
  }
  if (form.thinkingType === "tokens") {
    const tokens = Number(form.thinkingTokens);
    if (Number.isInteger(tokens) && tokens > 0) {
      return { type: "tokens", tokens };
    }
  }
  return undefined;
}

function buildForm(providerId: string): PresetForm {
  return {
    providerId,
    purpose: "chat",
    apiFormat: "chat_completions",
    modelId: "",
    temperature: "",
    maxTokens: "",
    thinkingType: "none",
    thinkingEffort: "medium",
    thinkingTokens: "",
  };
}

export function ModelPresetsPanel({ providers, onPresetsChange }: ModelPresetsPanelProps) {
  const defaultProviderId = providers[0]?.id ?? "";

  const [presets, setPresets] = useState<ModelPreset[]>([]);
  const [createForm, setCreateForm] = useState<PresetForm>(buildForm(defaultProviderId));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PresetForm | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!createForm.providerId && defaultProviderId) {
      setCreateForm((prev) => ({ ...prev, providerId: defaultProviderId }));
    }
  }, [createForm.providerId, defaultProviderId]);

  const loadPresets = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const rows = await requestJson<ModelPreset[]>("/api/settings/model-presets", {
        method: "GET",
      });
      setPresets(rows);
      onPresetsChange(rows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载预设失败");
    } finally {
      setLoading(false);
    }
  }, [onPresetsChange]);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  function alignApiFormat(form: PresetForm): PresetForm {
    if (form.purpose === "embedding") {
      return { ...form, apiFormat: "embeddings" };
    }
    if (form.apiFormat === "embeddings") {
      return { ...form, apiFormat: "chat_completions" };
    }
    return form;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createForm.providerId || createForm.modelId.trim().length === 0) {
      setMessage("Provider and Model ID are required.");
      return;
    }

    try {
      const payload = {
        providerId: createForm.providerId,
        purpose: createForm.purpose,
        apiFormat: createForm.apiFormat,
        modelId: createForm.modelId.trim(),
        temperature: createForm.temperature.trim() ? Number(createForm.temperature) : undefined,
        maxTokens: createForm.maxTokens.trim() ? Number(createForm.maxTokens) : undefined,
        thinkingBudget: toThinkingBudget(createForm),
      };
      await requestJson<ModelPreset>("/api/settings/model-presets", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCreateForm(buildForm(createForm.providerId));
      setShowCreate(false);
      await loadPresets();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "新增预设失败");
    }
  }

  function startEdit(preset: ModelPreset) {
    setEditingId(preset.id);
    setEditForm({
      providerId: preset.providerId,
      purpose: preset.purpose,
      apiFormat: preset.apiFormat,
      modelId: preset.modelId,
      temperature: typeof preset.temperature === "number" ? String(preset.temperature) : "",
      maxTokens: typeof preset.maxTokens === "number" ? String(preset.maxTokens) : "",
      thinkingType: preset.thinkingBudget?.type ?? "none",
      thinkingEffort: preset.thinkingBudget?.type === "effort" ? preset.thinkingBudget.effort : "medium",
      thinkingTokens: preset.thinkingBudget?.type === "tokens" ? String(preset.thinkingBudget.tokens) : "",
    });
  }

  async function handleSaveEdit(id: string) {
    if (!editForm) return;
    try {
      const payload = {
        providerId: editForm.providerId,
        purpose: editForm.purpose,
        apiFormat: editForm.apiFormat,
        modelId: editForm.modelId.trim(),
        temperature: editForm.temperature.trim() ? Number(editForm.temperature) : undefined,
        maxTokens: editForm.maxTokens.trim() ? Number(editForm.maxTokens) : undefined,
        thinkingBudget: toThinkingBudget(editForm),
      };

      await requestJson<ModelPreset>(`/api/settings/model-presets/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setEditingId(null);
      setEditForm(null);
      await loadPresets();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新预设失败");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this preset?")) return;
    try {
      await requestJson<{ success: boolean }>(`/api/settings/model-presets/${id}`, {
        method: "DELETE",
      });
      await loadPresets();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除预设失败");
    }
  }

  const getProviderName = (id: string) => providers.find(p => p.id === id)?.name || id;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Model Presets</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Define reusable configurations for different models and use cases.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? "Cancel" : "Add Preset"}
        </button>
      </div>

      {showCreate && (
        <div className="cn-panel animate-in fade-in slide-in-from-top-4 duration-200">
          <h3 className="text-sm font-medium mb-4">New Preset</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Provider</label>
                <select
                  className="w-full"
                  value={createForm.providerId}
                  onChange={(e) => setCreateForm(f => ({ ...f, providerId: e.target.value }))}
                >
                  <option value="">Select Provider</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Model ID</label>
                <input
                  className="w-full"
                  value={createForm.modelId}
                  onChange={(e) => setCreateForm(f => ({ ...f, modelId: e.target.value }))}
                  placeholder="e.g. gpt-4o, deepseek-chat"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Purpose</label>
                <select
                  className="w-full"
                  value={createForm.purpose}
                  onChange={(e) => setCreateForm(f => alignApiFormat({ ...f, purpose: e.target.value as any }))}
                >
                  <option value="chat">Chat</option>
                  <option value="embedding">Embedding</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">API Format</label>
                <select
                  className="w-full"
                  value={createForm.apiFormat}
                  onChange={(e) => setCreateForm(f => ({ ...f, apiFormat: e.target.value as any }))}
                  disabled={createForm.purpose === "embedding"}
                >
                  <option value="chat_completions">Chat Completions</option>
                  <option value="responses">Responses</option>
                  <option value="embeddings">Embeddings</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Temperature</label>
                <input
                  className="w-full"
                  value={createForm.temperature}
                  onChange={(e) => setCreateForm(f => ({ ...f, temperature: e.target.value }))}
                  placeholder="0.7 (Default)"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Max Tokens</label>
                <input
                  className="w-full"
                  value={createForm.maxTokens}
                  onChange={(e) => setCreateForm(f => ({ ...f, maxTokens: e.target.value }))}
                  placeholder="4096 (Default)"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">Thinking (o1/o3/DeepSeek-R1)</label>
              <div className="flex gap-4">
                <select
                  className="flex-1"
                  value={createForm.thinkingType}
                  onChange={(e) => setCreateForm(f => ({ ...f, thinkingType: e.target.value as any }))}
                >
                  <option value="none">Disabled</option>
                  <option value="effort">Effort Based (o1/o3)</option>
                  <option value="tokens">Token Based (DeepSeek-R1)</option>
                </select>
                {createForm.thinkingType === "effort" && (
                  <select
                    className="flex-1"
                    value={createForm.thinkingEffort}
                    onChange={(e) => setCreateForm(f => ({ ...f, thinkingEffort: e.target.value as any }))}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                )}
                {createForm.thinkingType === "tokens" && (
                  <input
                    className="flex-1"
                    value={createForm.thinkingTokens}
                    onChange={(e) => setCreateForm(f => ({ ...f, thinkingTokens: e.target.value }))}
                    placeholder="Budget (e.g. 4000)"
                  />
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className="primary">Create Preset</button>
            </div>
          </form>
        </div>
      )}

      {message && (
        <div className="p-3 text-sm rounded-md bg-red-50 text-red-600 border border-red-100">
          {message}
        </div>
      )}

      <div className="cn-panel p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground text-xs uppercase font-medium border-bottom border-border">
              <tr>
                <th className="px-6 py-3">Model</th>
                <th className="px-6 py-3">Provider / Purpose</th>
                <th className="px-6 py-3">Parameters</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {presets.map((preset) => (
                <tr key={preset.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium">{preset.modelId}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{preset.apiFormat}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-xs">{getProviderName(preset.providerId)}</span>
                      <span className="text-xs uppercase opacity-70">{preset.purpose}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {preset.temperature !== undefined && (
                        <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full font-medium">T: {preset.temperature}</span>
                      )}
                      {preset.maxTokens !== undefined && (
                        <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full font-medium">M: {preset.maxTokens}</span>
                      )}
                      {preset.thinkingBudget && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">THINKING</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="text-xs px-2 py-1" onClick={() => startEdit(preset)}>Edit</button>
                      <button className="text-xs px-2 py-1 text-red-600 hover:text-red-700" onClick={() => handleDelete(preset.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {presets.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    No presets configured. Click "Add Preset" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingId && editForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-background rounded-lg border border-border shadow-xl max-w-2xl w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold">Edit Preset</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Provider</label>
                <select
                  className="w-full"
                  value={editForm.providerId}
                  onChange={(e) => setEditForm(f => f ? ({ ...f, providerId: e.target.value }) : f)}
                >
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Model ID</label>
                <input
                  className="w-full"
                  value={editForm.modelId}
                  onChange={(e) => setEditForm(f => f ? ({ ...f, modelId: e.target.value }) : f)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Temperature</label>
                <input
                  className="w-full"
                  value={editForm.temperature}
                  onChange={(e) => setEditForm(f => f ? ({ ...f, temperature: e.target.value }) : f)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Max Tokens</label>
                <input
                  className="w-full"
                  value={editForm.maxTokens}
                  onChange={(e) => setEditForm(f => f ? ({ ...f, maxTokens: e.target.value }) : f)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setEditingId(null)}>Cancel</button>
              <button className="primary" onClick={() => handleSaveEdit(editingId)}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
