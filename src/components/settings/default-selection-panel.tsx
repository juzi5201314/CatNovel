"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  type ModelPreset,
  type ProjectSummary,
  requestJson,
} from "@/components/settings/types";

type DefaultSelectionPanelProps = {
  presets: ModelPreset[];
};

type DefaultsState = {
  defaultChatPresetId: string | null;
  defaultEmbeddingPresetId: string | null;
};

export function DefaultSelectionPanel({ presets }: DefaultSelectionPanelProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [defaults, setDefaults] = useState<DefaultsState>({
    defaultChatPresetId: null,
    defaultEmbeddingPresetId: null,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const chatPresets = useMemo(
    () => presets.filter((preset) => preset.purpose === "chat"),
    [presets],
  );
  const embeddingPresets = useMemo(
    () => presets.filter((preset) => preset.purpose === "embedding"),
    [presets],
  );

  useEffect(() => {
    async function loadProjects() {
      try {
        const rows = await requestJson<ProjectSummary[]>("/api/projects", { method: "GET" });
        setProjects(rows);
        if (rows.length > 0) {
          setSelectedProjectId((prev) => prev || rows[0].id);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "加载项目失败");
      }
    }

    void loadProjects();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProjectId) {
      setMessage("请选择项目");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await requestJson<{ success: boolean }>("/api/settings/llm-defaults", {
        method: "PATCH",
        body: JSON.stringify({
          projectId: selectedProjectId,
          defaultChatPresetId: defaults.defaultChatPresetId,
          defaultEmbeddingPresetId: defaults.defaultEmbeddingPresetId,
        }),
      });
      setMessage("默认预设已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存默认预设失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="cn-panel">
      <h3 className="cn-card-title">Project Defaults</h3>
      <p className="cn-card-description">设置项目级默认 Chat/Embedding 预设。</p>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="cn-card-description">项目</span>
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
          >
            <option value="">选择项目</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="cn-card-description">默认 Chat Preset</span>
          <select
            value={defaults.defaultChatPresetId ?? ""}
            onChange={(event) =>
              setDefaults((prev) => ({
                ...prev,
                defaultChatPresetId: event.target.value || null,
              }))
            }
          >
            <option value="">不设置</option>
            {chatPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.modelId} ({preset.apiFormat})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="cn-card-description">默认 Embedding Preset</span>
          <select
            value={defaults.defaultEmbeddingPresetId ?? ""}
            onChange={(event) =>
              setDefaults((prev) => ({
                ...prev,
                defaultEmbeddingPresetId: event.target.value || null,
              }))
            }
          >
            <option value="">不设置</option>
            {embeddingPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.modelId} ({preset.apiFormat})
              </option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "保存中..." : "保存默认配置"}
        </button>
      </form>

      {message ? <p className="cn-card-description">{message}</p> : null}
    </article>
  );
}
