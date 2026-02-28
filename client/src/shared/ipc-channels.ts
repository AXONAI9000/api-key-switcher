/**
 * IPC 通道名称常量
 * 纯常量文件，无任何 Node/Electron 依赖，可安全在 preload 中导入
 */
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
  GET_ACTUAL_ENV: 'env:get-actual',

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

  // Claude Code 更新
  CLAUDE_GET_VERSION: 'claude:get-version',
  CLAUDE_UPDATE: 'claude:update',
} as const;
