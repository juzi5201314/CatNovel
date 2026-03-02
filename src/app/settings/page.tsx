"use client";

import { useMemo, useState } from "react";

import { DefaultSelectionPanel } from "@/components/settings/default-selection-panel";
import { ModelPresetsPanel } from "@/components/settings/model-presets-panel";
import { ProvidersPanel } from "@/components/settings/providers-panel";
import { RotateKeyDialog } from "@/components/settings/rotate-key-dialog";
import type { ModelPreset, ProviderConfig } from "@/components/settings/types";

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [presets, setPresets] = useState<ModelPreset[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);

  const activeProvider = useMemo(
    () => providers.find((provider) => provider.id === activeProviderId) ?? null,
    [providers, activeProviderId],
  );

  return (
    <main className="cn-workspace">
      <section className="cn-column" style={{ gridColumn: "1 / -1" }}>
        <header className="cn-column-header">
          <h2>Settings</h2>
          <span>{providers.length} Providers / {presets.length} Presets</span>
        </header>

        <article className="cn-panel cn-panel-soft">
          <h3 className="cn-card-title">LLM 配置中心</h3>
          <p className="cn-card-description">
            管理 Provider、Model Preset、项目默认选择和密钥轮换。
          </p>
          <p className="cn-card-description">
            当前 Provider：{activeProvider ? activeProvider.name : "未选择"}
          </p>
        </article>
      </section>

      <section className="cn-column">
        <ProvidersPanel
          activeProviderId={activeProviderId}
          onActiveProviderIdChange={setActiveProviderId}
          onProvidersChange={setProviders}
        />
        <RotateKeyDialog
          providerId={activeProviderId}
          onDone={async () => {
            // 复用 ProvidersPanel 的数据回刷逻辑：这里只保留占位，避免额外依赖。
          }}
        />
      </section>

      <section className="cn-column">
        <ModelPresetsPanel providers={providers} onPresetsChange={setPresets} />
      </section>

      <section className="cn-column">
        <DefaultSelectionPanel presets={presets} />
      </section>
    </main>
  );
}
