import type { ProviderFamily } from '../../contracts/workspace.ts';

export type CompatibilityFlag = boolean | 'unknown';

export type ProviderApiType =
  | 'chat-completions'
  | 'responses'
  | 'messages'
  | 'generate-content';

export type ProviderAuthStyle = 'bearer' | 'api-key' | 'custom';

export type SupportedProviderCompatibilityFamily = Extract<
  ProviderFamily,
  'openai-compatible' | 'openai-responses' | 'claude-native' | 'gemini-native'
>;

export interface ProviderCompatibility {
  key: string;
  name: string;
  family: SupportedProviderCompatibilityFamily;
  apiType: ProviderApiType;
  baseUrl: string;
  authStyle: ProviderAuthStyle;
  toolCallingSupport: CompatibilityFlag;
  reasoningSupport: CompatibilityFlag;
  websiteUrl: string;
  hint?: string;
}

export interface ProviderFamilyCompatibility {
  family: SupportedProviderCompatibilityFamily;
  apiType: ProviderApiType;
  authStyle: ProviderAuthStyle;
  toolCallingSupport: CompatibilityFlag;
  reasoningSupport: CompatibilityFlag;
}

const UNKNOWN_SUPPORT = 'unknown' as const;

export const FAMILY_MATRIX: Record<
  SupportedProviderCompatibilityFamily,
  ProviderFamilyCompatibility
> = {
  'openai-compatible': {
    family: 'openai-compatible',
    apiType: 'chat-completions',
    authStyle: 'bearer',
    toolCallingSupport: UNKNOWN_SUPPORT,
    reasoningSupport: UNKNOWN_SUPPORT,
  },
  'openai-responses': {
    family: 'openai-responses',
    apiType: 'responses',
    authStyle: 'bearer',
    toolCallingSupport: UNKNOWN_SUPPORT,
    reasoningSupport: UNKNOWN_SUPPORT,
  },
  'claude-native': {
    family: 'claude-native',
    apiType: 'messages',
    authStyle: 'api-key',
    toolCallingSupport: UNKNOWN_SUPPORT,
    reasoningSupport: UNKNOWN_SUPPORT,
  },
  'gemini-native': {
    family: 'gemini-native',
    apiType: 'generate-content',
    authStyle: 'custom',
    toolCallingSupport: UNKNOWN_SUPPORT,
    reasoningSupport: UNKNOWN_SUPPORT,
  },
};

const presetProviders = [
  {
    key: 'zhipu',
    name: '智谱AI (GLM)',
    family: 'openai-compatible',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    websiteUrl: 'https://open.bigmodel.cn',
  },
  {
    key: 'deepseek',
    name: 'DeepSeek',
    family: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    websiteUrl: 'https://platform.deepseek.com',
  },
  {
    key: 'bailian',
    name: '阿里云百炼 (千问)',
    family: 'openai-compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    websiteUrl: 'https://bailian.console.aliyun.com',
    hint: '支持OpenAI和Anthropic两种格式',
  },
  {
    key: 'volcengine',
    name: '火山引擎 (豆包)',
    family: 'openai-compatible',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    websiteUrl: 'https://console.volcengine.com',
    hint: '需在控制台创建推理接入点',
  },
  {
    key: 'moonshot',
    name: 'Moonshot (Kimi)',
    family: 'openai-compatible',
    baseUrl: 'https://api.moonshot.cn/v1',
    websiteUrl: 'https://platform.moonshot.cn',
  },
  {
    key: 'stepfun',
    name: '阶跃星辰 (Step)',
    family: 'openai-compatible',
    baseUrl: 'https://api.stepfun.com/v1',
    websiteUrl: 'https://platform.stepfun.com',
  },
  {
    key: 'yi',
    name: '零一万物 (Yi)',
    family: 'openai-compatible',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    websiteUrl: 'https://platform.lingyiwanwu.com',
  },
  {
    key: 'baichuan',
    name: '百川 (Baichuan)',
    family: 'openai-compatible',
    baseUrl: 'https://api.baichuan-ai.com/v1',
    websiteUrl: 'https://platform.baichuan-ai.com',
  },
  {
    key: 'hunyuan',
    name: '腾讯混元',
    family: 'openai-compatible',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    websiteUrl: 'https://cloud.tencent.com/product/hunyuan',
  },
  {
    key: 'baidu',
    name: '百度文心',
    family: 'openai-compatible',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    websiteUrl: 'https://qianfan.cloud.baidu.com',
  },
  {
    key: 'minimax',
    name: 'MiniMax',
    family: 'openai-compatible',
    baseUrl: 'https://api.minimax.chat/v1',
    websiteUrl: 'https://platform.minimaxi.com',
  },
  {
    key: 'siliconflow',
    name: 'SiliconFlow (硅基流动)',
    family: 'openai-compatible',
    baseUrl: 'https://api.siliconflow.cn/v1',
    websiteUrl: 'https://siliconflow.cn',
  },
  {
    key: 'openai',
    name: 'OpenAI',
    family: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    websiteUrl: 'https://platform.openai.com',
  },
  {
    key: 'claude',
    name: 'Claude (Anthropic)',
    family: 'claude-native',
    baseUrl: 'https://api.anthropic.com',
    websiteUrl: 'https://console.anthropic.com',
  },
  {
    key: 'gemini',
    name: 'Gemini (OpenAI兼容)',
    family: 'openai-compatible',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    websiteUrl: 'https://aistudio.google.com',
  },
  {
    key: 'gemini-native',
    name: 'Gemini（原生格式）',
    family: 'gemini-native',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    websiteUrl: 'https://aistudio.google.com',
  },
  {
    key: 'groq',
    name: 'Groq',
    family: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    websiteUrl: 'https://console.groq.com',
  },
  {
    key: 'mistral',
    name: 'Mistral',
    family: 'openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    websiteUrl: 'https://console.mistral.ai',
  },
  {
    key: 'cohere',
    name: 'Cohere',
    family: 'openai-compatible',
    baseUrl: 'https://api.cohere.com/v2',
    websiteUrl: 'https://cohere.com',
  },
  {
    key: 'together',
    name: 'Together AI',
    family: 'openai-compatible',
    baseUrl: 'https://api.together.xyz/v1',
    websiteUrl: 'https://api.together.xyz',
  },
  {
    key: 'perplexity',
    name: 'Perplexity',
    family: 'openai-compatible',
    baseUrl: 'https://api.perplexity.ai',
    websiteUrl: 'https://www.perplexity.ai/settings',
  },
  {
    key: 'xai',
    name: 'xAI (Grok)',
    family: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    websiteUrl: 'https://console.x.ai',
  },
  {
    key: 'cerebras',
    name: 'Cerebras',
    family: 'openai-compatible',
    baseUrl: 'https://api.cerebras.ai/v1',
    websiteUrl: 'https://cloud.cerebras.ai',
  },
  {
    key: 'github',
    name: 'GitHub Models',
    family: 'openai-compatible',
    baseUrl: 'https://models.inference.ai.azure.com',
    websiteUrl: 'https://github.com/marketplace/models',
  },
  {
    key: 'openrouter',
    name: 'OpenRouter',
    family: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    websiteUrl: 'https://openrouter.ai',
  },
] satisfies Array<{
  key: string;
  name: string;
  family: SupportedProviderCompatibilityFamily;
  baseUrl: string;
  websiteUrl: string;
  hint?: string;
}>;

export const PROVIDER_MATRIX: ProviderCompatibility[] = presetProviders.map(
  (provider) => {
    const familyCompatibility = FAMILY_MATRIX[provider.family];

    return {
      ...provider,
      apiType: familyCompatibility.apiType,
      authStyle: familyCompatibility.authStyle,
      toolCallingSupport: familyCompatibility.toolCallingSupport,
      reasoningSupport: familyCompatibility.reasoningSupport,
    };
  },
);
