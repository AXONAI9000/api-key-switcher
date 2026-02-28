import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { ProviderType, AppConfig, ApiKey } from '../shared/types';
import type { SyncConfig, ConflictResolution, SyncStatusChangeEvent } from '../shared/sync/types';

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 配置相关
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG),
  saveConfig: (config: AppConfig) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_CONFIG, config),
  exportConfig: () => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_CONFIG),
  importConfig: () => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_CONFIG),

  // Key 管理
  addKey: (provider: ProviderType, key: string, alias?: string, baseUrl?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_KEY, provider, key, alias, baseUrl),
  removeKey: (provider: ProviderType, alias: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_KEY, provider, alias),
  updateKey: (provider: ProviderType, alias: string, updates: Partial<Pick<ApiKey, 'alias' | 'key' | 'enabled' | 'extraEnvVars'>>) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_KEY, provider, alias, updates),
  toggleKey: (provider: ProviderType, alias: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_KEY, provider, alias),
  switchKey: (provider: ProviderType, alias: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SWITCH_KEY, provider, alias),
  reorderKeys: (provider: ProviderType, aliases: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.REORDER_KEYS, provider, aliases),
  validateKey: (provider: ProviderType, key: string, baseUrl?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.VALIDATE_KEY, provider, key, baseUrl),
  getKeyStats: (provider: ProviderType) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_KEY_STATS, provider),
  setKeyExpiry: (provider: ProviderType, alias: string, expiresAt: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_KEY_EXPIRY, provider, alias, expiresAt),
  clearKeyExpiry: (provider: ProviderType, alias: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_KEY_EXPIRY, provider, alias),

  // 环境变量
  getCurrentEnv: (provider: ProviderType) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_CURRENT_ENV, provider),
  getActualEnv: (provider: ProviderType) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ACTUAL_ENV, provider),

  // 窗口控制
  minimizeToTray: () => ipcRenderer.invoke(IPC_CHANNELS.MINIMIZE_TO_TRAY),
  showWindow: () => ipcRenderer.invoke(IPC_CHANNELS.SHOW_WINDOW),
  closeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.CLOSE_WINDOW),

  // 监听配置更新事件
  onConfigUpdated: (callback: () => void) => {
    ipcRenderer.on('config-updated', callback);
    return () => {
      ipcRenderer.removeListener('config-updated', callback);
    };
  },

  // ========== 同步相关 API ==========

  // 获取同步配置
  syncGetConfig: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_CONFIG),

  // 保存同步配置
  syncSaveConfig: (config: Partial<SyncConfig>) =>
    ipcRenderer.invoke(IPC_CHANNELS.SYNC_SAVE_CONFIG, config),

  // 测试连接
  syncTestConnection: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_TEST_CONNECTION),

  // 拉取配置
  syncPull: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_PULL),

  // 推送配置
  syncPush: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_PUSH),

  // 执行同步
  syncExecute: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_EXECUTE),

  // 获取同步状态
  syncGetStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_STATUS),

  // 解决冲突
  syncResolveConflict: (resolution: ConflictResolution) =>
    ipcRenderer.invoke(IPC_CHANNELS.SYNC_RESOLVE_CONFLICT, resolution),

  // 设置主密码
  syncSetMasterPassword: (password: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SYNC_SET_MASTER_PASSWORD, password),

  // 验证主密码
  syncVerifyMasterPassword: (password: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SYNC_VERIFY_MASTER_PASSWORD, password),

  // 监听同步状态变更
  onSyncStatusChange: (callback: (event: SyncStatusChangeEvent) => void) => {
    ipcRenderer.on(IPC_CHANNELS.SYNC_STATUS_CHANGED, (_, data) => callback(data));
    return () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.SYNC_STATUS_CHANGED);
    };
  },

  // Claude Code 更新
  getClaudeVersion: () => ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_GET_VERSION),
  updateClaudeCode: () => ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_UPDATE),
});
