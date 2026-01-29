import { contextBridge, ipcRenderer } from 'electron';

// IPC 通道名称 (内联，避免 Electron preload 沙盒模块加载问题)
const IPC_CHANNELS = {
  GET_CONFIG: 'config:get',
  SAVE_CONFIG: 'config:save',
  EXPORT_CONFIG: 'config:export',
  IMPORT_CONFIG: 'config:import',
  ADD_KEY: 'key:add',
  REMOVE_KEY: 'key:remove',
  UPDATE_KEY: 'key:update',
  TOGGLE_KEY: 'key:toggle',
  SWITCH_KEY: 'key:switch',
  REORDER_KEYS: 'key:reorder',
  SET_ENV_VAR: 'env:set',
  GET_CURRENT_ENV: 'env:get-current',
  GET_ACTUAL_ENV: 'env:get-actual',
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

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 配置相关
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG),
  saveConfig: (config: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_CONFIG, config),
  exportConfig: () => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_CONFIG),
  importConfig: () => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_CONFIG),

  // Key 管理
  addKey: (provider: string, key: string, alias?: string, baseUrl?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_KEY, provider, key, alias, baseUrl),
  removeKey: (provider: string, alias: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_KEY, provider, alias),
  updateKey: (provider: string, alias: string, updates: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_KEY, provider, alias, updates),
  toggleKey: (provider: string, alias: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_KEY, provider, alias),
  switchKey: (provider: string, alias: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SWITCH_KEY, provider, alias),
  reorderKeys: (provider: string, aliases: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.REORDER_KEYS, provider, aliases),

  // 环境变量
  getCurrentEnv: (provider: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_CURRENT_ENV, provider),
  getActualEnv: (provider: string) =>
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
  syncSaveConfig: (config: unknown) =>
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
  syncResolveConflict: (resolution: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SYNC_RESOLVE_CONFLICT, resolution),

  // 设置主密码
  syncSetMasterPassword: (password: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SYNC_SET_MASTER_PASSWORD, password),

  // 验证主密码
  syncVerifyMasterPassword: (password: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SYNC_VERIFY_MASTER_PASSWORD, password),

  // 监听同步状态变更
  onSyncStatusChange: (callback: (event: unknown) => void) => {
    ipcRenderer.on(IPC_CHANNELS.SYNC_STATUS_CHANGED, (_, data) => callback(data));
    return () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.SYNC_STATUS_CHANGED);
    };
  },
});
