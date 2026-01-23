// API Key 类型定义
export interface ApiKey {
  alias: string;
  key: string;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
  // 额外的环境变量（如 BASE_URL）
  extraEnvVars?: Record<string, string>;
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

  // 环境变量
  SET_ENV_VAR: 'env:set',
  GET_CURRENT_ENV: 'env:get-current',
  GET_ACTUAL_ENV: 'env:get-actual', // 获取实际系统环境变量

  // 窗口控制
  MINIMIZE_TO_TRAY: 'window:minimize-to-tray',
  SHOW_WINDOW: 'window:show',
  CLOSE_WINDOW: 'window:close',
} as const;

// 实际环境变量状态
export interface ActualEnvStatus {
  envValue: string | null;           // 实际的环境变量值
  matchedAlias: string | null;       // 匹配到的配置 key 别名
  isManuallyModified: boolean;       // 是否被手动修改（环境变量值与所有配置都不匹配）
}

// IPC 响应类型
export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
