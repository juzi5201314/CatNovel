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
          setSelectedProjectId(rows[0].id);
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
      setMessage("Please select a project.");
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
      setMessage("Default presets saved successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存默认预设失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Project Defaults</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Set the default LLM configurations for each project.
        </p>
      </div>

      <div className="cn-panel">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">Select Project</label>
              <select
                className="w-full"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <option value="">Select a project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Default Chat Preset</label>
                <select
                  className="w-full"
                  value={defaults.defaultChatPresetId ?? ""}
                  onChange={(e) => setDefaults(d => ({ ...d, defaultChatPresetId: e.target.value || null }))}
                >
                  <option value="">None (Always ask)</option>
                  {chatPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.modelId} ({p.chatApiFormat ?? "chat_completions"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Default Embedding Preset</label>
                <select
                  className="w-full"
                  value={defaults.defaultEmbeddingPresetId ?? ""}
                  onChange={(e) => setDefaults(d => ({ ...d, defaultEmbeddingPresetId: e.target.value || null }))}
                >
                  <option value="">None</option>
                  {embeddingPresets.map((p) => (
                    <option key={p.id} value={p.id}>{p.modelId} (embedding)</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <button type="submit" className="primary" disabled={loading || !selectedProjectId}>
              {loading ? "Saving..." : "Save Defaults"}
            </button>
          </div>
        </form>
      </div>

      {message && (
        <div className={`p-3 text-sm rounded-md border ${message.includes('success') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
          {message}
        </div>
      )}
    </section>
  );
}
