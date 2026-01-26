/**
 * 同步管理器
 * 处理配置同步的核心逻辑
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type {
  SyncConfig,
  SyncStatus,
  SyncResult,
  ConflictData,
  ConflictResolution,
  EncryptedPackage,
  SyncStatusChangeEvent,
  SyncManagerState,
  ServerStatus,
  ConfigVersion,
  ISyncBackend,
  SyncBackendType,
  DEFAULT_SYNC_CONFIG,
} from './types';
import type { AppConfig } from '../types';
import {
  encryptConfig,
  decryptConfig,
  generateChecksum,
  generateDeviceId,
  hashMasterPassword,
  verifyMasterPassword,
  validateEncryptedPackage,
} from './crypto';
import { ServerSyncBackend } from './backends/server';
import { GistSyncBackend } from './backends/gist';
import { WebDAVSyncBackend } from './backends/webdav';

// 同步配置文件路径
const SYNC_CONFIG_DIR = path.join(os.homedir(), '.api-key-switcher');
const SYNC_CONFIG_FILE = path.join(SYNC_CONFIG_DIR, 'sync-config.json');
const MASTER_PASSWORD_FILE = path.join(SYNC_CONFIG_DIR, 'master-password.json');

/**
 * 主密码存储结构
 */
interface MasterPasswordStore {
  hash: string;
  salt: string;
}

/**
 * 状态变更监听器类型
 */
type StatusChangeListener = (event: SyncStatusChangeEvent) => void;

/**
 * 同步管理器类
 */
export class SyncManager {
  private config: SyncConfig;
  private backend: ISyncBackend | null = null;
  private deviceId: string;
  private masterPassword: string | null = null;
  private status: SyncStatus = 'idle';
  private lastSyncTime?: string;
  private pendingConflict?: ConflictData;
  private error?: string;
  private listeners: Set<StatusChangeListener> = new Set();
  private autoSyncTimer?: NodeJS.Timeout;

  constructor() {
    this.config = this.loadSyncConfig();
    this.deviceId = this.getOrCreateDeviceId();
  }

  /**
   * 初始化同步管理器
   */
  async initialize(): Promise<void> {
    if (this.config.enabled && this.config.autoSync) {
      this.startAutoSync();
    }
  }

  /**
   * 获取或创建设备 ID
   */
  private getOrCreateDeviceId(): string {
    if (this.config.deviceId) {
      return this.config.deviceId;
    }

    const deviceId = generateDeviceId();
    this.config.deviceId = deviceId;
    this.saveSyncConfig();
    return deviceId;
  }

  /**
   * 加载同步配置
   */
  private loadSyncConfig(): SyncConfig {
    try {
      if (fs.existsSync(SYNC_CONFIG_FILE)) {
        const content = fs.readFileSync(SYNC_CONFIG_FILE, 'utf8');
        return { ...this.getDefaultSyncConfig(), ...JSON.parse(content) };
      }
    } catch (error) {
      console.error('Failed to load sync config:', error);
    }
    return this.getDefaultSyncConfig();
  }

  /**
   * 获取默认同步配置
   */
  private getDefaultSyncConfig(): SyncConfig {
    return {
      enabled: false,
      backendType: 'server',
      autoSync: false,
      autoSyncInterval: 30,
    };
  }

  /**
   * 保存同步配置
   */
  private saveSyncConfig(): void {
    try {
      if (!fs.existsSync(SYNC_CONFIG_DIR)) {
        fs.mkdirSync(SYNC_CONFIG_DIR, { recursive: true });
      }
      fs.writeFileSync(SYNC_CONFIG_FILE, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save sync config:', error);
    }
  }

  /**
   * 获取同步配置
   */
  getSyncConfig(): SyncConfig {
    return { ...this.config };
  }

  /**
   * 更新同步配置
   */
  async updateSyncConfig(newConfig: Partial<SyncConfig>): Promise<void> {
    const wasEnabled = this.config.enabled;
    const wasAutoSync = this.config.autoSync;

    this.config = { ...this.config, ...newConfig };
    this.saveSyncConfig();

    // 处理后端切换
    if (newConfig.backendType && newConfig.backendType !== this.config.backendType) {
      await this.backend?.disconnect();
      this.backend = null;
    }

    // 处理自动同步状态变更
    if (this.config.enabled && this.config.autoSync) {
      if (!wasEnabled || !wasAutoSync) {
        this.startAutoSync();
      }
    } else {
      this.stopAutoSync();
    }
  }

  /**
   * 设置主密码
   */
  async setMasterPassword(password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { hash, salt } = await hashMasterPassword(password);
      const store: MasterPasswordStore = { hash, salt };

      if (!fs.existsSync(SYNC_CONFIG_DIR)) {
        fs.mkdirSync(SYNC_CONFIG_DIR, { recursive: true });
      }
      fs.writeFileSync(MASTER_PASSWORD_FILE, JSON.stringify(store));

      this.masterPassword = password;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set master password',
      };
    }
  }

  /**
   * 验证主密码
   */
  async verifyMasterPassword(password: string): Promise<{
    valid: boolean;
    isFirstTime: boolean;
    error?: string;
  }> {
    try {
      if (!fs.existsSync(MASTER_PASSWORD_FILE)) {
        return { valid: false, isFirstTime: true };
      }

      const content = fs.readFileSync(MASTER_PASSWORD_FILE, 'utf8');
      const store: MasterPasswordStore = JSON.parse(content);

      const valid = await verifyMasterPassword(password, store.hash, store.salt);
      if (valid) {
        this.masterPassword = password;
      }

      return { valid, isFirstTime: false };
    } catch (error) {
      return {
        valid: false,
        isFirstTime: false,
        error: error instanceof Error ? error.message : 'Failed to verify master password',
      };
    }
  }

  /**
   * 检查是否已设置主密码
   */
  hasMasterPassword(): boolean {
    return fs.existsSync(MASTER_PASSWORD_FILE);
  }

  /**
   * 检查主密码是否已验证
   */
  isMasterPasswordVerified(): boolean {
    return this.masterPassword !== null;
  }

  /**
   * 创建后端实例
   */
  private createBackend(): ISyncBackend | null {
    switch (this.config.backendType) {
      case 'server':
        if (this.config.serverConfig) {
          return new ServerSyncBackend(this.config.serverConfig, this.deviceId);
        }
        break;
      case 'gist':
        if (this.config.gistConfig) {
          return new GistSyncBackend(this.config.gistConfig, this.deviceId);
        }
        break;
      case 'webdav':
        if (this.config.webdavConfig) {
          return new WebDAVSyncBackend(this.config.webdavConfig, this.deviceId);
        }
        break;
    }
    return null;
  }

  /**
   * 获取或创建后端
   */
  private async getBackend(): Promise<ISyncBackend> {
    if (!this.backend) {
      this.backend = this.createBackend();
      if (!this.backend) {
        throw new Error('No backend configured');
      }
    }
    return this.backend;
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const backend = await this.getBackend();
      const connected = await backend.connect();
      return { success: connected };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * 获取服务器状态
   */
  async getServerStatus(): Promise<ServerStatus> {
    const backend = await this.getBackend();
    return backend.getStatus();
  }

  /**
   * 拉取配置
   */
  async pull(localConfig: AppConfig): Promise<SyncResult> {
    if (!this.masterPassword) {
      return { success: false, error: 'Master password not verified' };
    }

    this.updateStatus('downloading');

    try {
      const backend = await this.getBackend();
      const result = await backend.pull();

      if (!result.success) {
        this.updateStatus('error', result.error);
        return { success: false, error: result.error };
      }

      if (result.notFound || !result.data) {
        // 服务器没有数据，可以直接推送本地配置
        this.updateStatus('idle');
        return { success: true };
      }

      // 验证数据包
      if (!validateEncryptedPackage(result.data)) {
        this.updateStatus('error', 'Invalid data package');
        return { success: false, error: 'Invalid data package from server' };
      }

      // 解密配置
      const remoteConfig = await decryptConfig(result.data, this.masterPassword);

      // 检查是否有冲突
      const localChecksum = generateChecksum(JSON.stringify(localConfig));
      const remoteChecksum = result.data.checksum;

      if (localChecksum !== remoteChecksum) {
        // 有差异，检查时间戳
        const localTime = new Date(this.config.lastSyncTime || 0).getTime();
        const remoteTime = new Date(result.data.timestamp).getTime();

        if (localTime > 0 && remoteTime > localTime) {
          // 远程更新，可能有冲突
          const conflictData: ConflictData = {
            localVersion: this.createConfigVersion(localConfig, localChecksum),
            remoteVersion: {
              timestamp: result.data.timestamp,
              deviceId: result.data.deviceId,
              checksum: remoteChecksum,
              keyCount: this.countKeys(remoteConfig),
            },
          };

          this.pendingConflict = conflictData;
          this.updateStatus('conflict');
          return { success: false, conflictData };
        }
      }

      this.lastSyncTime = new Date().toISOString();
      this.config.lastSyncTime = this.lastSyncTime;
      this.saveSyncConfig();
      this.updateStatus('idle');

      return { success: true, syncedAt: this.lastSyncTime };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Pull failed';
      this.updateStatus('error', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 推送配置
   */
  async push(config: AppConfig): Promise<SyncResult> {
    if (!this.masterPassword) {
      return { success: false, error: 'Master password not verified' };
    }

    this.updateStatus('uploading');

    try {
      // 加密配置
      const encryptedPackage = await encryptConfig(
        config,
        this.masterPassword,
        this.deviceId
      );

      const backend = await this.getBackend();
      const result = await backend.push(encryptedPackage);

      if (!result.success) {
        this.updateStatus('error', result.error);
        return { success: false, error: result.error };
      }

      this.lastSyncTime = result.timestamp;
      this.config.lastSyncTime = this.lastSyncTime;
      this.saveSyncConfig();
      this.updateStatus('idle');

      return { success: true, syncedAt: this.lastSyncTime };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Push failed';
      this.updateStatus('error', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 双向同步
   */
  async sync(localConfig: AppConfig): Promise<SyncResult> {
    if (!this.masterPassword) {
      return { success: false, error: 'Master password not verified' };
    }

    this.updateStatus('syncing');

    try {
      const backend = await this.getBackend();

      // 先拉取
      const pullResult = await backend.pull();

      if (!pullResult.success) {
        this.updateStatus('error', pullResult.error);
        return { success: false, error: pullResult.error };
      }

      // 如果服务器没有数据，直接推送
      if (pullResult.notFound || !pullResult.data) {
        return this.push(localConfig);
      }

      // 验证并解密
      if (!validateEncryptedPackage(pullResult.data)) {
        this.updateStatus('error', 'Invalid data package');
        return { success: false, error: 'Invalid data package from server' };
      }

      const remoteConfig = await decryptConfig(pullResult.data, this.masterPassword);

      // 检查是否需要合并
      const localChecksum = generateChecksum(JSON.stringify(localConfig));
      const remoteChecksum = pullResult.data.checksum;

      if (localChecksum === remoteChecksum) {
        // 配置相同，无需同步
        this.updateStatus('idle');
        return { success: true };
      }

      // 有差异，检查是否有冲突
      const localTime = new Date(this.config.lastSyncTime || 0).getTime();
      const remoteTime = new Date(pullResult.data.timestamp).getTime();

      if (localTime > 0 && remoteTime > localTime) {
        // 可能有冲突
        const conflictData: ConflictData = {
          localVersion: this.createConfigVersion(localConfig, localChecksum),
          remoteVersion: {
            timestamp: pullResult.data.timestamp,
            deviceId: pullResult.data.deviceId,
            checksum: remoteChecksum,
            keyCount: this.countKeys(remoteConfig),
          },
        };

        this.pendingConflict = conflictData;
        this.updateStatus('conflict');
        return { success: false, conflictData };
      }

      // 本地更新，推送到服务器
      return this.push(localConfig);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      this.updateStatus('error', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 解决冲突
   */
  async resolveConflict(
    resolution: ConflictResolution,
    localConfig: AppConfig
  ): Promise<{ success: boolean; config?: AppConfig; error?: string }> {
    if (!this.pendingConflict) {
      return { success: false, error: 'No pending conflict' };
    }

    if (!this.masterPassword) {
      return { success: false, error: 'Master password not verified' };
    }

    try {
      const backend = await this.getBackend();

      switch (resolution) {
        case 'local':
          // 使用本地版本，覆盖远程
          const pushResult = await this.push(localConfig);
          if (pushResult.success) {
            this.pendingConflict = undefined;
            return { success: true, config: localConfig };
          }
          return { success: false, error: pushResult.error };

        case 'remote':
          // 使用远程版本
          const pullResult = await backend.pull();
          if (pullResult.success && pullResult.data) {
            const remoteConfig = await decryptConfig(pullResult.data, this.masterPassword);
            this.pendingConflict = undefined;
            this.lastSyncTime = new Date().toISOString();
            this.config.lastSyncTime = this.lastSyncTime;
            this.saveSyncConfig();
            this.updateStatus('idle');
            return { success: true, config: remoteConfig };
          }
          return { success: false, error: 'Failed to pull remote config' };

        case 'merge':
          // 合并两个版本
          const mergePullResult = await backend.pull();
          if (mergePullResult.success && mergePullResult.data) {
            const remoteConfig = await decryptConfig(mergePullResult.data, this.masterPassword);
            const mergedConfig = this.mergeConfigs(localConfig, remoteConfig);

            // 推送合并后的配置
            const mergePushResult = await this.push(mergedConfig);
            if (mergePushResult.success) {
              this.pendingConflict = undefined;
              return { success: true, config: mergedConfig };
            }
            return { success: false, error: mergePushResult.error };
          }
          return { success: false, error: 'Failed to pull remote config for merge' };

        default:
          return { success: false, error: 'Invalid resolution strategy' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resolve conflict',
      };
    }
  }

  /**
   * 合并配置
   */
  private mergeConfigs(local: AppConfig, remote: AppConfig): AppConfig {
    const merged: AppConfig = {
      version: local.version,
      providers: { ...local.providers },
    };

    // 合并每个服务商的 keys
    for (const providerKey of Object.keys(remote.providers) as Array<keyof typeof remote.providers>) {
      const localProvider = local.providers[providerKey];
      const remoteProvider = remote.providers[providerKey];

      if (!localProvider) {
        // 本地没有，使用远程
        merged.providers[providerKey] = remoteProvider;
        continue;
      }

      if (!remoteProvider) {
        // 远程没有，保留本地
        continue;
      }

      // 合并 keys（按 alias 去重，保留最新的）
      const keyMap = new Map<string, typeof localProvider.keys[0]>();

      // 先添加本地 keys
      for (const key of localProvider.keys) {
        keyMap.set(key.alias, key);
      }

      // 再添加远程 keys（如果更新则覆盖）
      for (const key of remoteProvider.keys) {
        const existingKey = keyMap.get(key.alias);
        if (!existingKey) {
          keyMap.set(key.alias, key);
        } else {
          // 比较更新时间
          const localTime = new Date(existingKey.updatedAt || existingKey.createdAt).getTime();
          const remoteTime = new Date(key.updatedAt || key.createdAt).getTime();
          if (remoteTime > localTime) {
            keyMap.set(key.alias, key);
          }
        }
      }

      merged.providers[providerKey] = {
        ...localProvider,
        keys: Array.from(keyMap.values()),
        currentKey: localProvider.currentKey || remoteProvider.currentKey,
      };
    }

    return merged;
  }

  /**
   * 创建配置版本信息
   */
  private createConfigVersion(config: AppConfig, checksum: string): ConfigVersion {
    return {
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      checksum,
      keyCount: this.countKeys(config),
    };
  }

  /**
   * 统计配置中的 key 数量
   */
  private countKeys(config: AppConfig): number {
    let count = 0;
    for (const provider of Object.values(config.providers)) {
      count += provider.keys.length;
    }
    return count;
  }

  /**
   * 更新状态
   */
  private updateStatus(status: SyncStatus, error?: string): void {
    this.status = status;
    this.error = error;

    const event: SyncStatusChangeEvent = {
      status,
      error,
    };

    this.notifyListeners(event);
  }

  /**
   * 通知监听器
   */
  private notifyListeners(event: SyncStatusChangeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in status change listener:', error);
      }
    }
  }

  /**
   * 添加状态变更监听器
   */
  addStatusListener(listener: StatusChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 获取当前状态
   */
  getState(): SyncManagerState {
    return {
      status: this.status,
      lastSyncTime: this.lastSyncTime,
      error: this.error,
      pendingConflict: this.pendingConflict,
    };
  }

  /**
   * 启动自动同步
   */
  private startAutoSync(): void {
    this.stopAutoSync();

    const intervalMs = this.config.autoSyncInterval * 60 * 1000;
    this.autoSyncTimer = setInterval(() => {
      // 自动同步逻辑由 IPC 层触发
      this.notifyListeners({
        status: 'syncing',
        message: 'Auto sync triggered',
      });
    }, intervalMs);
  }

  /**
   * 停止自动同步
   */
  private stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = undefined;
    }
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    this.stopAutoSync();
    await this.backend?.disconnect();
    this.listeners.clear();
  }
}

// 单例实例
let syncManagerInstance: SyncManager | null = null;

/**
 * 获取同步管理器实例
 */
export function getSyncManager(): SyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager();
  }
  return syncManagerInstance;
}

/**
 * 重置同步管理器实例（用于测试）
 */
export function resetSyncManager(): void {
  syncManagerInstance?.dispose();
  syncManagerInstance = null;
}
