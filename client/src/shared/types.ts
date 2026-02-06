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

// IPC 通道名称
export const IPC_CHANNELS = {
  // 配置相关
  GET_CONFIG: 'config:get',
  SAVE_CONFIG: 'config:save',
  EXPORT_CONFIG: 'config:export',
  IMPORT_CONFIG: 'config:import',

  // Key 管理
  ADD_KEY: 'key:add',
  REMOVE_KEY: 'key:remove',
  UPDATE_KEY: 'key:update',
  TOGGLE_KEY: 'key:toggle',
  SWITCH_KEY: 'key:switch',
  REORDER_KEYS: 'key:reorder',
  VALIDATE_KEY: 'key:validate',
  GET_KEY_STATS: 'key:get-stats',
  SET_KEY_EXPIRY: 'key:set-expiry',
  CLEAR_KEY_EXPIRY: 'key:clear-expiry',

  // 环境变量
  SET_ENV_VAR: 'env:set',
  GET_CURRENT_ENV: 'env:get-current',
  GET_ACTUAL_ENV: 'env:get-actual', // 获取实际系统环境变量

  // 窗口控制
  MINIMIZE_TO_TRAY: 'window:minimize-to-tray',
  SHOW_WINDOW: 'window:show',
  CLOSE_WINDOW: 'window:close',

  // 同步相关
  SYNC_GET_CONFIG: 'sync:get-config',
  SYNC_SAVE_CONFIG: 'sync:save-config',
  SYNC_TEST_CONNECTION: 'sync:test-connection',
  SYNC_PULL: 'sync:pull',
  SYNC_PUSH: 'sync:push',
  SYNC_EXECUTE: 'sync:execute',
  SYNC_GET_STATUS: 'sync:get-status',
  SYNC_RESOLVE_CONFLICT: 'sync:resolve-conflict',
  SYNC_SET_MASTER_PASSWORD: 'sync:set-master-password',
  SYNC_VERIFY_MASTER_PASSWORD: 'sync:verify-master-password',
  SYNC_STATUS_CHANGED: 'sync:status-changed',
} as const;

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
