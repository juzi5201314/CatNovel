import { getModel } from '@mariozechner/pi-ai';
import type { Api, Model, Provider } from '@mariozechner/pi-ai';

import type { ProviderProfile } from './provider-registry.ts';
import {
  FAMILY_MATRIX,
  type SupportedProviderCompatibilityFamily,
} from './provider-compatibility-matrix.ts';

const openAIModelTemplate = getModel('openai', 'gpt-4o-mini');
const anthropicModelTemplate = getModel('anthropic', 'claude-sonnet-4-20250514');
const googleModelTemplate = getModel('google', 'gemini-2.5-pro');

type SupportedApi =
  | 'anthropic-messages'
  | 'google-generative-ai'
  | 'openai-completions'
  | 'openai-responses';

export interface ModelFromProfileResult {
  model: Model<SupportedApi>;
  family: SupportedProviderCompatibilityFamily;
  apiKey: string;
  authStyle: (typeof FAMILY_MATRIX)[SupportedProviderCompatibilityFamily]['authStyle'];
}

export function getModelFromProfile(
  profile: ProviderProfile,
): ModelFromProfileResult {
  const family = assertSupportedFamily(profile.family);
  const modelId = resolveModelId(profile);
  const apiKey = profile.apiKey.trim();

  if (!apiKey) {
    throw new Error(`Provider profile "${profile.label}" is missing an API key.`);
  }

  try {
    const familyConfig = FAMILY_MATRIX[family];

    switch (family) {
      case 'openai-compatible':
        return {
          model: createOpenAICompatibleModel(modelId, profile.endpoint),
          family,
          apiKey,
          authStyle: familyConfig.authStyle,
        };
      case 'openai-responses':
        return {
          model: createOpenAIResponsesModel(modelId, profile.endpoint),
          family,
          apiKey,
          authStyle: familyConfig.authStyle,
        };
      case 'claude-native':
        return {
          model: createClaudeModel(modelId, profile.endpoint),
          family,
          apiKey,
          authStyle: familyConfig.authStyle,
        };
      case 'gemini-native':
        return {
          model: createGeminiModel(modelId, profile.endpoint),
          family,
          apiKey,
          authStyle: familyConfig.authStyle,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown adapter error';
    throw new Error(
      `Failed to create pi-ai model for provider profile "${profile.label}": ${message}`,
    );
  }
}

function createOpenAICompatibleModel(
  modelId: string,
  baseUrl: string,
): Model<'openai-completions'> {
  return cloneModel(openAIModelTemplate, {
    id: modelId,
    name: modelId,
    api: 'openai-completions',
    provider: 'catnovel-openai-compatible',
    baseUrl: normalizeBaseUrl(baseUrl),
  });
}

function createOpenAIResponsesModel(
  modelId: string,
  baseUrl: string,
): Model<'openai-responses'> {
  return cloneModel(openAIModelTemplate, {
    id: modelId,
    name: modelId,
    api: 'openai-responses',
    provider: 'catnovel-openai-responses',
    baseUrl: normalizeBaseUrl(baseUrl),
  });
}

function createClaudeModel(
  modelId: string,
  baseUrl: string,
): Model<'anthropic-messages'> {
  return cloneModel(anthropicModelTemplate, {
    id: modelId,
    name: modelId,
    api: 'anthropic-messages',
    provider: 'catnovel-claude-native',
    baseUrl: normalizeBaseUrl(baseUrl),
  });
}

function createGeminiModel(
  modelId: string,
  baseUrl: string,
): Model<'google-generative-ai'> {
  return cloneModel(googleModelTemplate, {
    id: modelId,
    name: modelId,
    api: 'google-generative-ai',
    provider: 'catnovel-gemini-native',
    baseUrl: normalizeBaseUrl(baseUrl),
  });
}

function cloneModel<TApi extends SupportedApi>(
  template: Model<Api>,
  overrides: {
    id: string;
    name: string;
    api: TApi;
    provider: Provider;
    baseUrl: string;
  },
): Model<TApi> {
  return {
    ...template,
    ...overrides,
  } as Model<TApi>;
}

function resolveModelId(profile: ProviderProfile): string {
  const modelId = profile.modelIds[0]?.trim();

  if (!modelId) {
    throw new Error(`Provider profile "${profile.label}" does not have a model id.`);
  }

  return modelId;
}

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '');

  if (!normalized) {
    throw new Error('Provider endpoint is required.');
  }

  return normalized;
}

function assertSupportedFamily(
  family: ProviderProfile['family'],
): SupportedProviderCompatibilityFamily {
  if (family in FAMILY_MATRIX) {
    return family as SupportedProviderCompatibilityFamily;
  }

  throw new Error(`Unsupported provider family: ${family}`);
}
