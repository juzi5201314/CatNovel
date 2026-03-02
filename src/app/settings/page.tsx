"use client";

import { useMemo, useState } from "react";

import { DefaultSelectionPanel } from "@/components/settings/default-selection-panel";
import { ModelPresetsPanel } from "@/components/settings/model-presets-panel";
import { ProvidersPanel } from "@/components/settings/providers-panel";
import { RotateKeyDialog } from "@/components/settings/rotate-key-dialog";
import type { ModelPreset, ProviderConfig } from "@/components/settings/types";

type Tab = "providers" | "presets" | "defaults";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("providers");
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [presets, setPresets] = useState<ModelPreset[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);

  const activeProvider = useMemo(
    () => providers.find((provider) => provider.id === activeProviderId) ?? null,
    [providers, activeProviderId],
  );

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your AI providers, model presets, and project defaults.
        </p>
      </header>

      <nav className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === "providers" ? "active" : ""}`}
          onClick={() => setActiveTab("providers")}
        >
          Providers
        </button>
        <button
          className={`settings-tab ${activeTab === "presets" ? "active" : ""}`}
          onClick={() => setActiveTab("presets")}
        >
          Model Presets
        </button>
        <button
          className={`settings-tab ${activeTab === "defaults" ? "active" : ""}`}
          onClick={() => setActiveTab("defaults")}
        >
          Defaults
        </button>
      </nav>

      <div className="space-y-8">
        {activeTab === "providers" && (
          <div className="space-y-6">
            <ProvidersPanel
              activeProviderId={activeProviderId}
              onActiveProviderIdChange={setActiveProviderId}
              onProvidersChange={setProviders}
            />
            <RotateKeyDialog
              providerId={activeProviderId}
              onDone={async () => {
                // Done callback
              }}
            />
          </div>
        )}

        {activeTab === "presets" && (
          <ModelPresetsPanel providers={providers} onPresetsChange={setPresets} />
        )}

        {activeTab === "defaults" && (
          <DefaultSelectionPanel presets={presets} />
        )}
      </div>
    </main>
  );
}
