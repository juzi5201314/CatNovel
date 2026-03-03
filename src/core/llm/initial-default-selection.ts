type PresetPurpose = "chat" | "embedding";

export type PresetCandidate = {
  id: string;
  providerId: string;
  purpose: PresetPurpose;
  isBuiltin?: boolean | null;
  createdAt?: Date | number | null;
};

export type ProviderCandidate = {
  id: string;
  enabled?: boolean | null;
  apiKeyRef?: string | null;
};

export type InitialDefaultSelection = {
  defaultChatPresetId: string | null;
  defaultEmbeddingPresetId: string | null;
};

const BUILTIN_CHAT_PRESET_ID = "preset_chat_completions_default";
const BUILTIN_EMBEDDING_PRESET_ID = "preset_embedding_default";

function toMillis(value: Date | number | null | undefined): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return 0;
}

function selectPresetId(
  presets: PresetCandidate[],
  providerMap: Map<string, ProviderCandidate>,
  purpose: PresetPurpose,
  preferredId: string,
): string | null {
  const ranked = presets
    .filter((item) => item.purpose === purpose)
    .sort((left, right) => toMillis(left.createdAt) - toMillis(right.createdAt))
    .reverse();

  if (ranked.length === 0) {
    return null;
  }

  const preferred = ranked.find((item) => item.id === preferredId);
  if (preferred) {
    return preferred.id;
  }

  const builtin = ranked.find((item) => item.isBuiltin);
  if (builtin) {
    return builtin.id;
  }

  const enabledNoSecret = ranked.find((item) => {
    const provider = providerMap.get(item.providerId);
    if (!provider || provider.enabled === false) {
      return false;
    }
    return !provider.apiKeyRef;
  });
  if (enabledNoSecret) {
    return enabledNoSecret.id;
  }

  const enabled = ranked.find((item) => providerMap.get(item.providerId)?.enabled !== false);
  if (enabled) {
    return enabled.id;
  }

  return ranked[0]?.id ?? null;
}

export function resolveInitialDefaultSelection(
  presets: PresetCandidate[],
  providers: ProviderCandidate[],
): InitialDefaultSelection {
  const providerMap = new Map(providers.map((provider) => [provider.id, provider]));

  return {
    defaultChatPresetId: selectPresetId(
      presets,
      providerMap,
      "chat",
      BUILTIN_CHAT_PRESET_ID,
    ),
    defaultEmbeddingPresetId: selectPresetId(
      presets,
      providerMap,
      "embedding",
      BUILTIN_EMBEDDING_PRESET_ID,
    ),
  };
}
