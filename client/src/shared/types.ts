// API Key 类型定义
export interface ApiKey {
  alias: string;
  key: string;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
  // 额外的环境变量（如 BASE_URL）
  extraEnvVars?: Record<string, string>;
  // 使用统计
  switchCount?: number;
  lastUsedAt?: string;
  totalUsageMs?: number;
  // 过期设置
  expiresAt?: string;
}

// 服务商配置
export interface ProviderConfig {
  envVar: string;
  currentKey: string | null;
  keys: ApiKey[];
}

// 支持的服务商类型
export type ProviderType = 'claude' | 'openai' | 'gemini' | 'deepseek' | 'custom';

// 服务商显示信息
export interface ProviderInfo {
  id: ProviderType;
  name: string;
  envVar: string;
  description: string;
}

// 完整配置文件结构
export interface AppConfig {
  version: string;
  providers: Record<ProviderType, ProviderConfig>;
}

// 默认服务商配置
export const DEFAULT_PROVIDERS: Record<ProviderType, ProviderInfo> = {
  claude: {
    id: 'claude',
    name: 'Claude (Anthropic)',
    envVar: 'ANTHROPIC_AUTH_TOKEN',
    description: 'Anthropic Claude API',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    description: 'OpenAI GPT API',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini (Google)',
    envVar: 'GOOGLE_API_KEY',
    description: 'Google Gemini API',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    envVar: 'DEEPSEEK_API_KEY',
    description: 'DeepSeek API',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    envVar: 'CUSTOM_API_KEY',
    description: '自定义服务商',
  },
};

// 服务商对应的 BASE_URL 环境变量名
export const BASE_URL_ENV_MAP: Record<ProviderType, string> = {
  claude: 'ANTHROPIC_BASE_URL',
  openai: 'OPENAI_BASE_URL',
  gemini: 'GOOGLE_API_BASE_URL',
  deepseek: 'DEEPSEEK_BASE_URL',
  custom: 'CUSTOM_BASE_URL',
};

// IPC 通道名称（从独立的纯常量文件导入，preload 也使用同一份定义）
export { IPC_CHANNELS } from './ipc-channels';

// 实际环境变量状态
export interface ActualEnvStatus {
  envValue: string | null;           // 实际的环境变量值
  matchedAlias: string | null;       // 匹配到的配置 key 别名
  isManuallyModified: boolean;       // 是否被手动修改（环境变量值与所有配置都不匹配）
}

// Key 使用统计
export interface KeyUsageStats {
  alias: string;
  provider: ProviderType;
  switchCount: number;
  lastUsedAt: string | null;
  totalUsageMs: number;
  expiresAt: string | null;
  isExpired: boolean;
  isExpiringSoon: boolean; // 7天内过期
}

// IPC 响应类型
export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
