import type {
  ProviderFamily,
  SettingNodeType,
  WorkspaceLocale,
} from '@/lib/contracts/workspace';

export type LocaleText = Record<WorkspaceLocale, string>;

export const settingTypeLabels: Record<SettingNodeType, LocaleText> = {
  character: {
    zh: '角色',
    en: 'Character',
    ru: 'Персонаж',
  },
  location: {
    zh: '地点',
    en: 'Location',
    ru: 'Локация',
  },
  item: {
    zh: '物品',
    en: 'Item',
    ru: 'Предмет',
  },
  world: {
    zh: '世界观',
    en: 'World',
    ru: 'Мир',
  },
  plot: {
    zh: '剧情',
    en: 'Plot',
    ru: 'Сюжет',
  },
  rule: {
    zh: '规则',
    en: 'Rule',
    ru: 'Правило',
  },
};

export const providerFamilyLabels: Record<ProviderFamily, LocaleText> = {
  'openai-compatible': {
    zh: 'OpenAI-compatible',
    en: 'OpenAI-compatible',
    ru: 'OpenAI-compatible',
  },
  'openai-responses': {
    zh: 'OpenAI Responses',
    en: 'OpenAI Responses',
    ru: 'OpenAI Responses',
  },
  'gemini-native': {
    zh: 'Gemini-native',
    en: 'Gemini-native',
    ru: 'Gemini-native',
  },
  'claude-native': {
    zh: 'Claude-native',
    en: 'Claude-native',
    ru: 'Claude-native',
  },
  'custom-endpoint': {
    zh: 'Custom Endpoint',
    en: 'Custom Endpoint',
    ru: 'Custom Endpoint',
  },
};

export function t(locale: WorkspaceLocale, text: LocaleText) {
  return text[locale];
}

export function parseChapterText(bodyJson: string) {
  try {
    const parsed = JSON.parse(bodyJson) as {
      content?: Array<{ content?: Array<{ text?: string }> }>;
    };

    return (
      parsed.content
        ?.flatMap((block) => block.content ?? [])
        .map((node) => node.text ?? '')
        .join('\n')
        .trim() ?? ''
    );
  } catch {
    return bodyJson;
  }
}

export function serializeChapterText(text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: entry }],
    }));

  return JSON.stringify({
    type: 'doc',
    content: paragraphs,
  });
}

export function parseSettingSummary(payloadJson: string) {
  try {
    const parsed = JSON.parse(payloadJson) as { summary?: string };
    return parsed.summary ?? '';
  } catch {
    return payloadJson;
  }
}

export function serializeSettingSummary(summary: string) {
  return JSON.stringify({ summary });
}
