import { ProviderType, ApiKey, AppConfig, IpcResponse, ActualEnvStatus } from '../../shared/types';

export interface ElectronAPI {
  // 配置相关
  getConfig: () => Promise<IpcResponse<AppConfig>>;
  saveConfig: (config: AppConfig) => Promise<IpcResponse>;
  exportConfig: () => Promise<IpcResponse<string>>;
  importConfig: () => Promise<IpcResponse<AppConfig>>;

  // Key 管理
  addKey: (
    provider: ProviderType,
    key: string,
    alias?: string,
    baseUrl?: string
  ) => Promise<IpcResponse<ApiKey>>;
  removeKey: (provider: ProviderType, alias: string) => Promise<IpcResponse>;
  updateKey: (
    provider: ProviderType,
    alias: string,
    updates: Partial<Pick<ApiKey, 'alias' | 'key' | 'enabled'>>
  ) => Promise<IpcResponse<ApiKey>>;
  toggleKey: (
    provider: ProviderType,
    alias: string
  ) => Promise<IpcResponse<{ enabled: boolean }>>;
  switchKey: (provider: ProviderType, alias: string) => Promise<IpcResponse>;
  reorderKeys: (
    provider: ProviderType,
    aliases: string[]
  ) => Promise<IpcResponse<ApiKey[]>>;

  // 环境变量
  getCurrentEnv: (
    provider: ProviderType
  ) => Promise<IpcResponse<{ alias: string; key: string; masked: string } | null>>;
  getActualEnv: (
    provider: ProviderType
  ) => Promise<IpcResponse<ActualEnvStatus>>;

  // 窗口控制
  minimizeToTray: () => Promise<IpcResponse>;
  showWindow: () => Promise<IpcResponse>;
  closeWindow: () => Promise<IpcResponse>;

  // 监听配置更新事件
  onConfigUpdated: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
