/**
 * 同步模块类型定义
 */

// 同步后端类型
export type SyncBackendType = 'server' | 'gist' | 'webdav';

// 同步状态
export type SyncStatus = 'idle' | 'syncing' | 'uploading' | 'downloading' | 'conflict' | 'error';

// 冲突解决策略
export type ConflictResolution = 'local' | 'remote' | 'merge';

// 自建服务器配置
export interface ServerSyncConfig {
  url: string;
  // 注意：token 已移除，改用 JWT 认证
  // 认证状态由 AuthService 管理
}

// GitHub Gist 配置
export interface GistSyncConfig {
  token: string;
  gistId?: string;
}

// WebDAV 配置
export interface WebDAVSyncConfig {
  url: string;
  username: string;
  password: string;
  path: string;
}

// 同步配置
export interface SyncConfig {
  enabled: boolean;
  backendType: SyncBackendType;
  autoSync: boolean;
  autoSyncInterval: number; // 分钟
  lastSyncTime?: string;
  deviceId?: string;

  // 后端配置
  serverConfig?: ServerSyncConfig;
  gistConfig?: GistSyncConfig;
  webdavConfig?: WebDAVSyncConfig;
}

// 默认同步配置
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: false,
  backendType: 'server',
  autoSync: false,
  autoSyncInterval: 30,
};

// 加密数据包
export interface EncryptedPackage {
  encryptedData: string;  // Base64 编码的加密数据
  iv: string;             // Base64 编码的初始化向量
  salt: string;           // Base64 编码的盐值
  checksum: string;       // SHA-256 校验和
  version: number;        // 数据格式版本
  timestamp: string;      // ISO 时间戳
  deviceId: string;       // 设备 ID
}

// 同步结果
export interface SyncResult {
  success: boolean;
  error?: string;
  conflictData?: ConflictData;
  syncedAt?: string;
}

// 冲突数据
export interface ConflictData {
  localVersion: ConfigVersion;
  remoteVersion: ConfigVersion;
}

// 配置版本信息
export interface ConfigVersion {
  timestamp: string;
  deviceId: string;
  checksum: string;
  keyCount: number;
}

// 服务器状态响应
export interface ServerStatus {
  connected: boolean;
  hasData: boolean;
  lastUpdated?: string;
  deviceId?: string;
  version?: number;
}

// 推送结果
export interface PushResult {
  success: boolean;
  timestamp?: string;
  error?: string;
}

// 拉取结果
export interface PullResult {
  success: boolean;
  data?: EncryptedPackage;
  notFound?: boolean;
  error?: string;
}

// 同步后端接口
export interface ISyncBackend {
  readonly type: SyncBackendType;

  connect(): Promise<boolean>;
  getStatus(): Promise<ServerStatus>;
  pull(): Promise<PullResult>;
  push(data: EncryptedPackage): Promise<PushResult>;
  disconnect(): Promise<void>;
}

// 同步状态变更事件
export interface SyncStatusChangeEvent {
  status: SyncStatus;
  message?: string;
  progress?: number;
  error?: string;
}

// 同步管理器状态
export interface SyncManagerState {
  status: SyncStatus;
  lastSyncTime?: string;
  error?: string;
  pendingConflict?: ConflictData;
}

// 主密码验证结果
export interface MasterPasswordResult {
  valid: boolean;
  isFirstTime: boolean;
  error?: string;
}

// 加密密钥信息
export interface EncryptionKeyInfo {
  key: CryptoKey;
  salt: Uint8Array;
}
