"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  type ProviderCategory,
  type ProviderConfig,
  type ProviderProtocol,
  requestJson,
} from "@/components/settings/types";

type ProviderForm = {
  name: string;
  protocol: ProviderProtocol;
  category: ProviderCategory;
  baseURL: string;
  enabled: boolean;
  apiKey: string;
};

type ProvidersPanelProps = {
  activeProviderId: string | null;
  onActiveProviderIdChange: (providerId: string | null) => void;
  onProvidersChange: (providers: ProviderConfig[]) => void;
};

const EMPTY_PROVIDER_FORM: ProviderForm = {
  name: "",
  protocol: "openai_compatible",
  category: "both",
  baseURL: "",
  enabled: true,
  apiKey: "",
};

export function ProvidersPanel({
  activeProviderId,
  onActiveProviderIdChange,
  onProvidersChange,
}: ProvidersPanelProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [createForm, setCreateForm] = useState<ProviderForm>(EMPTY_PROVIDER_FORM);
  const [editForm, setEditForm] = useState<ProviderForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const rows = await requestJson<ProviderConfig[]>("/api/settings/providers", {
        method: "GET",
      });
      setProviders(rows);
      onProvidersChange(rows);
      if (!activeProviderId && rows.length > 0) {
        onActiveProviderIdChange(rows[0].id);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载 Provider 失败");
    } finally {
      setLoading(false);
    }
  }, [activeProviderId, onActiveProviderIdChange, onProvidersChange]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createForm.name.trim().length === 0 || createForm.baseURL.trim().length === 0) {
      setMessage("Name and Base URL are required.");
      return;
    }

    try {
      await requestJson<ProviderConfig>("/api/settings/providers", {
        method: "POST",
        body: JSON.stringify({
          ...createForm,
          name: createForm.name.trim(),
          baseURL: createForm.baseURL.trim(),
          apiKey: createForm.apiKey.trim() || undefined,
        }),
      });
      setCreateForm(EMPTY_PROVIDER_FORM);
      setShowCreate(false);
      await loadProviders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建 Provider 失败");
    }
  }

  function startEdit(provider: ProviderConfig) {
    setEditingId(provider.id);
    setEditForm({
      name: provider.name,
      protocol: provider.protocol,
      category: provider.category,
      baseURL: provider.baseURL,
      enabled: provider.enabled,
      apiKey: "",
    });
  }

  async function handleSaveEdit(provider: ProviderConfig) {
    if (!editForm) return;
    try {
      await requestJson<ProviderConfig>(`/api/settings/providers/${provider.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          protocol: editForm.protocol,
          category: editForm.category,
          baseURL: editForm.baseURL,
          enabled: editForm.enabled,
          apiKey: editForm.apiKey.trim() || undefined,
        }),
      });
      setEditingId(null);
      setEditForm(null);
      await loadProviders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新 Provider 失败");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this provider?")) return;
    try {
      await requestJson<{ success: boolean }>(`/api/settings/providers/${id}`, {
        method: "DELETE",
      });
      await loadProviders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除 Provider 失败");
    }
  }

  async function handleToggleEnabled(provider: ProviderConfig) {
    try {
      await requestJson<ProviderConfig>(`/api/settings/providers/${provider.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !provider.enabled }),
      });
      await loadProviders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "切换启停失败");
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Providers</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure your AI service endpoints and authentication.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? "Cancel" : "Add Provider"}
        </button>
      </div>

      {showCreate && (
        <div className="cn-panel animate-in fade-in slide-in-from-top-4 duration-200">
          <h3 className="text-sm font-medium mb-4">New Provider</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Name</label>
                <input
                  className="w-full"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. DeepSeek"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Protocol</label>
                <select
                  className="w-full"
                  value={createForm.protocol}
                  onChange={(e) => setCreateForm(f => ({ ...f, protocol: e.target.value as any }))}
                >
                  <option value="openai_compatible">OpenAI Compatible</option>
                  <option value="openai_responses">OpenAI Responses</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Category</label>
                <select
                  className="w-full"
                  value={createForm.category}
                  onChange={(e) => setCreateForm(f => ({ ...f, category: e.target.value as any }))}
                >
                  <option value="chat">Chat Only</option>
                  <option value="embedding">Embedding Only</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">API Key (Optional)</label>
                <input
                  type="password"
                  className="w-full"
                  value={createForm.apiKey}
                  onChange={(e) => setCreateForm(f => ({ ...f, apiKey: e.target.value }))}
                  placeholder="sk-..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">Base URL</label>
              <input
                className="w-full"
                value={createForm.baseURL}
                onChange={(e) => setCreateForm(f => ({ ...f, baseURL: e.target.value }))}
                placeholder="https://api.deepseek.com/v1"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={createForm.enabled}
                onChange={(e) => setCreateForm(f => ({ ...f, enabled: e.target.checked }))}
              />
              <label htmlFor="enabled" className="text-sm">Enabled</label>
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="primary">Create Provider</button>
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
                <th className="px-6 py-3">Provider</th>
                <th className="px-6 py-3">Protocol / Category</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {providers.map((provider) => {
                const isEditing = editingId === provider.id && editForm;
                const isActive = activeProviderId === provider.id;

                return (
                  <tr key={provider.id} className={`hover:bg-muted/50 transition-colors ${isActive ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-medium flex items-center gap-2">
                        {provider.name}
                        {isActive && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">ACTIVE</span>}
                        {provider.isBuiltin && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">BUILTIN</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate" title={provider.baseURL}>
                        {provider.baseURL}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs uppercase opacity-70">{provider.protocol}</span>
                        <span className="text-xs font-medium">{provider.category}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${provider.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                        {provider.enabled ? 'Enabled' : 'Disabled'}
                        {provider.hasApiKey && <span title="API Key Configured">🔑</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {!isActive && provider.enabled && (
                          <button
                            className="text-xs px-2 py-1"
                            onClick={() => onActiveProviderIdChange(provider.id)}
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          className="text-xs px-2 py-1"
                          onClick={() => handleToggleEnabled(provider)}
                        >
                          {provider.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          className="text-xs px-2 py-1"
                          onClick={() => startEdit(provider)}
                        >
                          Edit
                        </button>
                        {!provider.isBuiltin && (
                          <button
                            className="text-xs px-2 py-1 text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(provider.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {providers.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    No providers configured. Click "Add Provider" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingId && editForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-background rounded-lg border border-border shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold">Edit Provider</h3>
            <div className="space-y-4">
               {/* Simplified edit form in dialog */}
               <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Name</label>
                <input
                  className="w-full"
                  value={editForm.name}
                  onChange={(e) => setEditForm(f => f ? ({ ...f, name: e.target.value }) : f)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Base URL</label>
                <input
                  className="w-full"
                  value={editForm.baseURL}
                  onChange={(e) => setEditForm(f => f ? ({ ...f, baseURL: e.target.value }) : f)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">API Key (Leave blank to keep current)</label>
                <input
                  type="password"
                  className="w-full"
                  value={editForm.apiKey}
                  onChange={(e) => setEditForm(f => f ? ({ ...f, apiKey: e.target.value }) : f)}
                  placeholder="••••••••"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-enabled"
                  checked={editForm.enabled}
                  onChange={(e) => setEditForm(f => f ? ({ ...f, enabled: e.target.checked }) : f)}
                />
                <label htmlFor="edit-enabled" className="text-sm">Enabled</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setEditingId(null)}>Cancel</button>
              <button className="primary" onClick={() => handleSaveEdit(providers.find(p => p.id === editingId)!)}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
