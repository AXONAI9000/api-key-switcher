import { ProviderType, ApiKey, AppConfig, IpcResponse, ActualEnvStatus } from '../../shared/types';
import type {
  SyncConfig,
  SyncResult,
  SyncManagerState,
  SyncStatusChangeEvent,
  ConflictResolution,
  MasterPasswordResult,
} from '../../shared/sync/types';

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

  // ========== 同步相关 API ==========

  // 获取同步配置
  syncGetConfig: () => Promise<IpcResponse<SyncConfig>>;

  // 保存同步配置
  syncSaveConfig: (config: Partial<SyncConfig>) => Promise<IpcResponse>;

  // 测试连接
  syncTestConnection: () => Promise<IpcResponse<{ connected: boolean }>>;

  // 拉取配置
  syncPull: () => Promise<IpcResponse<SyncResult>>;

  // 推送配置
  syncPush: () => Promise<IpcResponse<SyncResult>>;

  // 执行同步
  syncExecute: () => Promise<IpcResponse<SyncResult>>;

  // 获取同步状态
  syncGetStatus: () => Promise<IpcResponse<SyncManagerState>>;

  // 解决冲突
  syncResolveConflict: (
    resolution: ConflictResolution
  ) => Promise<IpcResponse<AppConfig | null>>;

  // 设置主密码
  syncSetMasterPassword: (password: string) => Promise<IpcResponse>;

  // 验证主密码
  syncVerifyMasterPassword: (
    password: string
  ) => Promise<IpcResponse<MasterPasswordResult>>;

  // 监听同步状态变更
  onSyncStatusChange: (callback: (event: SyncStatusChangeEvent) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
