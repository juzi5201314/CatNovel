"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  type ProviderCategory,
  type ProviderConfig,
  type ProviderProtocol,
  requestJson,
} from "@/components/settings/types";
import { Skeleton } from "@/components/ui/skeleton";

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

function toProviderProtocol(value: string): ProviderProtocol {
  return value === "openai_responses" ? "openai_responses" : "openai_compatible";
}

function toProviderCategory(value: string): ProviderCategory {
  if (value === "chat" || value === "embedding") {
    return value;
  }
  return "both";
}

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
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, protocol: toProviderProtocol(e.target.value) }))
                  }
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
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, category: toProviderCategory(e.target.value) }))
                  }
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
        <div className="p-3 text-sm rounded-md bg-red-50 text-red-600 border border-red-100 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {message}
        </div>
      )}

      <div className="cn-panel p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground text-[10px] uppercase font-bold tracking-widest border-b border-border">
              <tr>
                <th className="px-6 py-4">Provider</th>
                <th className="px-6 py-4">Protocol / Category</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-in fade-in duration-500">
                    <td className="px-6 py-5"><Skeleton className="h-10 w-48" /></td>
                    <td className="px-6 py-5"><Skeleton className="h-10 w-32" /></td>
                    <td className="px-6 py-5"><Skeleton className="h-10 w-24" /></td>
                    <td className="px-6 py-5"><Skeleton className="h-10 w-32 ml-auto" /></td>
                  </tr>
                ))
              ) : (
                providers.map((provider) => {
                  const isActive = activeProviderId === provider.id;

                  return (
                    <tr key={provider.id} className={`hover:bg-muted/30 transition-all ${isActive ? 'bg-accent/5' : ''}`}>
                      <td className="px-6 py-5">
                        <div className="font-bold flex items-center gap-2">
                          {provider.name}
                          {isActive && <span className="text-[9px] bg-accent text-accent-foreground px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm">ACTIVE</span>}
                          {provider.isBuiltin && <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">BUILTIN</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate font-medium opacity-60" title={provider.baseURL}>
                          {provider.baseURL}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{provider.protocol}</span>
                          <span className="text-xs font-bold text-muted-foreground">{provider.category}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2.5">
                          <div className={`h-2 w-2 rounded-full shadow-sm ${provider.enabled ? 'bg-green-500 shadow-green-500/20' : 'bg-gray-300'}`} />
                          <span className={`text-xs font-bold ${provider.enabled ? 'text-green-600' : 'text-muted-foreground'}`}>{provider.enabled ? 'Live' : 'Paused'}</span>
                          {provider.hasApiKey && <div className="bg-muted p-1 rounded" title="Key Confirmed"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3-3.5 3.5z"/></svg></div>}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          {!isActive && provider.enabled && (
                            <button
                              className="text-[10px] font-bold px-3 py-1.5 rounded bg-accent/10 text-accent hover:bg-accent hover:text-accent-foreground transition-all"
                              onClick={() => onActiveProviderIdChange(provider.id)}
                            >
                              Activate
                            </button>
                          )}
                          <button
                            className="text-[10px] font-bold px-3 py-1.5 rounded hover:bg-muted transition-all"
                            onClick={() => handleToggleEnabled(provider)}
                          >
                            {provider.enabled ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            className="text-[10px] font-bold px-3 py-1.5 rounded hover:bg-muted transition-all"
                            onClick={() => startEdit(provider)}
                          >
                            Settings
                          </button>
                          {!provider.isBuiltin && (
                            <button
                              className="text-[10px] font-bold px-3 py-1.5 rounded text-red-600 hover:bg-red-50 transition-all"
                              onClick={() => handleDelete(provider.id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {providers.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-3 opacity-40">
                       <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="M7 12h10M7 16h10M12 20v2M12 2v2"/></svg>
                       <p className="text-sm font-bold uppercase tracking-widest">No Providers Available</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingId && editForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-background rounded-xl border border-border shadow-2xl max-w-md w-full p-8 space-y-6 zoom-in-95 animate-in duration-200">
            <div>
              <h3 className="text-lg font-bold tracking-tight">Provider Settings</h3>
              <p className="text-xs text-muted-foreground font-medium uppercase mt-1 tracking-wider opacity-60">Update configuration for {editForm.name}</p>
            </div>
            <div className="space-y-5">
               <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Display Name</label>
                <input
                  className="w-full font-bold"
                  value={editForm.name}
                  onChange={(e) => setEditForm(f => f ? ({ ...f, name: e.target.value }) : f)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">API Base URL</label>
                <input
                  className="w-full font-mono text-xs"
                  value={editForm.baseURL}
                  onChange={(e) => setEditForm(f => f ? ({ ...f, baseURL: e.target.value }) : f)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">API Key <span className="text-[9px] opacity-40 italic ml-1">(Encrypted at rest)</span></label>
                <input
                  type="password"
                  className="w-full"
                  value={editForm.apiKey}
                  onChange={(e) => setEditForm(f => f ? ({ ...f, apiKey: e.target.value }) : f)}
                  placeholder="Leave empty to keep existing key"
                />
              </div>
              <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg border border-border/50">
                <input
                  type="checkbox"
                  id="edit-enabled"
                  className="w-4 h-4 rounded border-border"
                  checked={editForm.enabled}
                  onChange={(e) => setEditForm(f => f ? ({ ...f, enabled: e.target.checked }) : f)}
                />
                <label htmlFor="edit-enabled" className="text-xs font-bold uppercase tracking-tight">Enable Provider</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setEditingId(null)} className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 hover:bg-muted rounded transition-colors">Cancel</button>
              <button className="primary text-[10px] font-bold uppercase tracking-widest px-6 py-2 rounded shadow-lg shadow-black/5" onClick={() => handleSaveEdit(providers.find(p => p.id === editingId)!)}>Update Provider</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
