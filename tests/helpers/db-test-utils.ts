import type { ProviderFamily } from '../../lib/contracts/workspace.ts';
import { closeDatabase } from '../../db/client.ts';

/**
 * 默认测试供应商配置
 * 用于测试环境初始化，不应用于生产环境
 */
export const defaultTestProfiles: Array<{
  id: string;
  family: ProviderFamily;
  label: string;
  endpoint: string;
  model: string;
  modelIds: string[];
  apiKeyEnv: string;
  apiKey: string;
  enabled: boolean;
}> = [
  {
    id: 'openai-default',
    family: 'openai-compatible' as ProviderFamily,
    label: 'OpenAI-compatible',
    endpoint: 'https://api.openai.local/v1',
    model: 'gpt-4.1',
    modelIds: ['gpt-4.1', 'gpt-4o-mini'],
    apiKeyEnv: 'OPENAI_API_KEY',
    apiKey: 'openai-test-key',
    enabled: true,
  },
  {
    id: 'gemini-default',
    family: 'gemini-native' as ProviderFamily,
    label: 'Gemini-native',
    endpoint: 'https://generativelanguage.googleapis.local',
    model: 'gemini-2.5-pro',
    modelIds: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    apiKeyEnv: 'GEMINI_API_KEY',
    apiKey: 'gemini-test-key',
    enabled: true,
  },
  {
    id: 'claude-default',
    family: 'claude-native' as ProviderFamily,
    label: 'Claude-native',
    endpoint: 'https://api.anthropic.local/v1',
    model: 'claude-sonnet-4',
    modelIds: ['claude-sonnet-4', 'claude-haiku-4'],
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    apiKey: 'claude-test-key',
    enabled: true,
  },
  {
    id: 'ollama-default',
    family: 'openai-compatible' as ProviderFamily,
    label: 'Ollama',
    endpoint: 'http://localhost:11434/v1',
    model: 'llama3.2',
    modelIds: ['llama3.2'],
    apiKeyEnv: 'OLLAMA_API_KEY',
    apiKey: 'ollama',
    enabled: false,
  },
];

/**
 * 设置内存数据库环境变量
 * 在导入数据库模块之前调用
 */
export function setupMemoryDatabase(): void {
  closeDatabase();
  process.env.CATNOVEL_DB_MEMORY = 'true';
  // 清除其他数据库路径设置，确保使用内存模式
  delete process.env.CATNOVEL_DB_FILE;
  delete process.env.CATNOVEL_DATA_DIR;
}

/**
 * 清理数据库连接
 * 每个测试结束后调用，确保状态隔离
 */
export function teardownMemoryDatabase(): void {
  closeDatabase();
  delete process.env.CATNOVEL_DB_MEMORY;
}

/**
 * 生成随机测试ID，避免冲突
 */
export function generateTestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
