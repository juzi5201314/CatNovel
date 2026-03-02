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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const hasActive = useMemo(
    () => providers.some((provider) => provider.id === activeProviderId),
    [providers, activeProviderId],
  );

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
      if (activeProviderId && !rows.some((provider) => provider.id === activeProviderId)) {
        onActiveProviderIdChange(rows[0]?.id ?? null);
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
      setMessage("name 与 baseURL 不能为空");
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
    if (!editForm) {
      return;
    }

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

  async function handleDelete(provider: ProviderConfig) {
    try {
      await requestJson<{ success: boolean }>(`/api/settings/providers/${provider.id}`, {
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
    <article className="cn-panel">
      <h3 className="cn-card-title">Providers</h3>
      <p className="cn-card-description">配置供应商、协议、启停和密钥状态。</p>

      <form onSubmit={handleCreate} className="mt-3 flex flex-col gap-2">
        <input
          value={createForm.name}
          onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Provider 名称"
        />
        <div className="flex gap-2">
          <select
            value={createForm.protocol}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                protocol: event.target.value as ProviderProtocol,
              }))
            }
          >
            <option value="openai_compatible">openai_compatible</option>
            <option value="openai_responses">openai_responses</option>
          </select>

          <select
            value={createForm.category}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                category: event.target.value as ProviderCategory,
              }))
            }
          >
            <option value="chat">chat</option>
            <option value="embedding">embedding</option>
            <option value="both">both</option>
          </select>
        </div>

        <input
          value={createForm.baseURL}
          onChange={(event) =>
            setCreateForm((prev) => ({ ...prev, baseURL: event.target.value }))
          }
          placeholder="https://api.example.com/v1"
        />
        <input
          type="password"
          value={createForm.apiKey}
          onChange={(event) =>
            setCreateForm((prev) => ({ ...prev, apiKey: event.target.value }))
          }
          placeholder="可选 API Key"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={createForm.enabled}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, enabled: event.target.checked }))
            }
          />
          启用
        </label>
        <button type="submit">新增 Provider</button>
      </form>

      {loading ? <p className="cn-card-description">加载中...</p> : null}
      {message ? <p className="cn-card-description">{message}</p> : null}

      <ul className="mt-3 flex flex-col gap-2">
        {providers.map((provider) => {
          const isEditing = editingId === provider.id && editForm;
          return (
            <li key={provider.id} className="rounded-md border border-[var(--cn-border)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{provider.name}</strong>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onActiveProviderIdChange(provider.id)}
                    disabled={activeProviderId === provider.id}
                  >
                    {activeProviderId === provider.id ? "当前" : "设为当前"}
                  </button>
                  <button type="button" onClick={() => handleToggleEnabled(provider)}>
                    {provider.enabled ? "停用" : "启用"}
                  </button>
                  <button type="button" onClick={() => startEdit(provider)}>
                    编辑
                  </button>
                  {!provider.isBuiltin ? (
                    <button type="button" onClick={() => void handleDelete(provider)}>
                      删除
                    </button>
                  ) : null}
                </div>
              </div>

              <p className="cn-card-description">
                {provider.protocol} / {provider.category} / {provider.baseURL}
              </p>
              <p className="cn-card-description">
                内置：{provider.isBuiltin ? "是" : "否"}，密钥：
                {provider.hasApiKey ? "已配置" : "未配置"}
              </p>

              {isEditing ? (
                <div className="mt-2 flex flex-col gap-2 rounded-md bg-[var(--cn-surface-muted)] p-2">
                  <input
                    value={editForm.name}
                    onChange={(event) =>
                      setEditForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                    }
                    placeholder="名称"
                    disabled={provider.isBuiltin}
                  />
                  <div className="flex gap-2">
                    <select
                      value={editForm.protocol}
                      onChange={(event) =>
                        setEditForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                protocol: event.target.value as ProviderProtocol,
                              }
                            : prev,
                        )
                      }
                      disabled={provider.isBuiltin}
                    >
                      <option value="openai_compatible">openai_compatible</option>
                      <option value="openai_responses">openai_responses</option>
                    </select>
                    <select
                      value={editForm.category}
                      onChange={(event) =>
                        setEditForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                category: event.target.value as ProviderCategory,
                              }
                            : prev,
                        )
                      }
                    >
                      <option value="chat">chat</option>
                      <option value="embedding">embedding</option>
                      <option value="both">both</option>
                    </select>
                  </div>
                  <input
                    value={editForm.baseURL}
                    onChange={(event) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, baseURL: event.target.value } : prev,
                      )
                    }
                    placeholder="baseURL"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.enabled}
                      onChange={(event) =>
                        setEditForm((prev) =>
                          prev ? { ...prev, enabled: event.target.checked } : prev,
                        )
                      }
                    />
                    启用
                  </label>
                  <input
                    type="password"
                    value={editForm.apiKey}
                    onChange={(event) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, apiKey: event.target.value } : prev,
                      )
                    }
                    placeholder="可选：覆盖 API Key"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void handleSaveEdit(provider)}>
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditForm(null);
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {!hasActive ? <p className="cn-card-description">当前没有可用 Provider。</p> : null}
    </article>
  );
}
