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

  useEffect(() => {
    onPresetsChange(presets);
  }, [presets, onPresetsChange]);

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
      setMessage("providerId 与 modelId 必填");
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
      temperature:
        typeof preset.temperature === "number" ? String(preset.temperature) : "",
      maxTokens: typeof preset.maxTokens === "number" ? String(preset.maxTokens) : "",
      thinkingType: preset.thinkingBudget?.type ?? "none",
      thinkingEffort:
        preset.thinkingBudget?.type === "effort"
          ? preset.thinkingBudget.effort
          : "medium",
      thinkingTokens:
        preset.thinkingBudget?.type === "tokens"
          ? String(preset.thinkingBudget.tokens)
          : "",
    });
  }

  async function handleSaveEdit(preset: ModelPreset) {
    if (!editForm) {
      return;
    }

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

      await requestJson<ModelPreset>(`/api/settings/model-presets/${preset.id}`, {
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

  async function handleDelete(preset: ModelPreset) {
    try {
      await requestJson<{ success: boolean }>(`/api/settings/model-presets/${preset.id}`, {
        method: "DELETE",
      });
      await loadPresets();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除预设失败");
    }
  }

  return (
    <article className="cn-panel">
      <h3 className="cn-card-title">Model Presets</h3>
      <p className="cn-card-description">新增、编辑、删除模型预设，含 apiFormat 切换。</p>

      <form onSubmit={handleCreate} className="mt-3 flex flex-col gap-2">
        <select
          value={createForm.providerId}
          onChange={(event) =>
            setCreateForm((prev) => ({ ...prev, providerId: event.target.value }))
          }
        >
          <option value="">选择 Provider</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <select
            value={createForm.purpose}
            onChange={(event) =>
              setCreateForm((prev) =>
                alignApiFormat({ ...prev, purpose: event.target.value as PresetPurpose }),
              )
            }
          >
            <option value="chat">chat</option>
            <option value="embedding">embedding</option>
          </select>

          <select
            value={createForm.apiFormat}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                apiFormat: event.target.value as PresetApiFormat,
              }))
            }
            disabled={createForm.purpose === "embedding"}
          >
            <option value="chat_completions">chat_completions</option>
            <option value="responses">responses</option>
            <option value="embeddings">embeddings</option>
          </select>
        </div>

        <input
          value={createForm.modelId}
          onChange={(event) =>
            setCreateForm((prev) => ({ ...prev, modelId: event.target.value }))
          }
          placeholder="modelId"
        />

        <div className="flex gap-2">
          <input
            value={createForm.temperature}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, temperature: event.target.value }))
            }
            placeholder="temperature(可选)"
          />
          <input
            value={createForm.maxTokens}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, maxTokens: event.target.value }))
            }
            placeholder="maxTokens(可选)"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={createForm.thinkingType}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                thinkingType: event.target.value as PresetForm["thinkingType"],
              }))
            }
          >
            <option value="none">thinking: none</option>
            <option value="effort">thinking: effort</option>
            <option value="tokens">thinking: tokens</option>
          </select>

          {createForm.thinkingType === "effort" ? (
            <select
              value={createForm.thinkingEffort}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  thinkingEffort: event.target.value as "low" | "medium" | "high",
                }))
              }
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          ) : null}

          {createForm.thinkingType === "tokens" ? (
            <input
              value={createForm.thinkingTokens}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  thinkingTokens: event.target.value,
                }))
              }
              placeholder="thinking tokens"
            />
          ) : null}
        </div>

        <button type="submit">新增 Preset</button>
      </form>

      {loading ? <p className="cn-card-description">加载中...</p> : null}
      {message ? <p className="cn-card-description">{message}</p> : null}

      <ul className="mt-3 flex flex-col gap-2">
        {presets.map((preset) => {
          const isEditing = editingId === preset.id && editForm;
          return (
            <li key={preset.id} className="rounded-md border border-[var(--cn-border)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{preset.modelId}</strong>
                <div className="flex gap-2">
                  <button type="button" onClick={() => startEdit(preset)}>
                    编辑
                  </button>
                  <button type="button" onClick={() => void handleDelete(preset)}>
                    删除
                  </button>
                </div>
              </div>

              <p className="cn-card-description">
                {preset.purpose} / {preset.apiFormat} / provider={preset.providerId}
              </p>

              {isEditing ? (
                <div className="mt-2 flex flex-col gap-2 rounded-md bg-[var(--cn-surface-muted)] p-2">
                  <select
                    value={editForm.providerId}
                    onChange={(event) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, providerId: event.target.value } : prev,
                      )
                    }
                  >
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    <select
                      value={editForm.purpose}
                      onChange={(event) =>
                        setEditForm((prev) =>
                          prev
                            ? alignApiFormat({
                                ...prev,
                                purpose: event.target.value as PresetPurpose,
                              })
                            : prev,
                        )
                      }
                    >
                      <option value="chat">chat</option>
                      <option value="embedding">embedding</option>
                    </select>

                    <select
                      value={editForm.apiFormat}
                      onChange={(event) =>
                        setEditForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                apiFormat: event.target.value as PresetApiFormat,
                              }
                            : prev,
                        )
                      }
                      disabled={editForm.purpose === "embedding"}
                    >
                      <option value="chat_completions">chat_completions</option>
                      <option value="responses">responses</option>
                      <option value="embeddings">embeddings</option>
                    </select>
                  </div>

                  <input
                    value={editForm.modelId}
                    onChange={(event) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, modelId: event.target.value } : prev,
                      )
                    }
                    placeholder="modelId"
                  />

                  <div className="flex gap-2">
                    <input
                      value={editForm.temperature}
                      onChange={(event) =>
                        setEditForm((prev) =>
                          prev ? { ...prev, temperature: event.target.value } : prev,
                        )
                      }
                      placeholder="temperature"
                    />
                    <input
                      value={editForm.maxTokens}
                      onChange={(event) =>
                        setEditForm((prev) =>
                          prev ? { ...prev, maxTokens: event.target.value } : prev,
                        )
                      }
                      placeholder="maxTokens"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button type="button" onClick={() => void handleSaveEdit(preset)}>
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
    </article>
  );
}
