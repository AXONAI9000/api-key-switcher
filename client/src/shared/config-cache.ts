/**
 * ConfigCache - 配置缓存模块
 * 提供内存缓存层，减少磁盘 I/O，支持延迟写入和自动备份
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AppConfig, ProviderType, DEFAULT_PROVIDERS } from './types';
import { Logger } from './logger';

const CONFIG_DIR = path.join(os.homedir(), '.api-key-switcher');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CONFIG_BACKUP_FILE = path.join(CONFIG_DIR, 'config.json.backup');

const FLUSH_DELAY_MS = 1000;

const logger = new Logger('ConfigCache');

export class ConfigCache {
  private cache: AppConfig | null = null;
  private dirty: boolean = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * 获取配置（深拷贝）
   * 首次调用时从磁盘加载，后续从缓存返回
   */
  get(): AppConfig {
    if (this.cache === null) {
      this.loadFromDisk();
    }
    return JSON.parse(JSON.stringify(this.cache)) as AppConfig;
  }

  /**
   * 更新缓存中的配置，标记为 dirty 并调度延迟写入
   */
  set(config: AppConfig): void {
    this.cache = JSON.parse(JSON.stringify(config)) as AppConfig;
    this.dirty = true;
    this.scheduleFlush();
  }

  /**
   * 立即将缓存写入磁盘（如果有未保存的更改）
   */
  flush(): void {
    this.clearFlushTimer();
    if (this.dirty && this.cache !== null) {
      this.saveToDisk();
      this.dirty = false;
    }
  }

  /**
   * 检查是否有未保存的更改
   */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * 使缓存失效：先刷写未保存的更改，然后清除缓存
   */
  invalidate(): void {
    this.flush();
    this.cache = null;
  }

  /**
   * 释放资源：刷写未保存的更改并清理定时器
   */
  dispose(): void {
    this.flush();
    this.clearFlushTimer();
  }

  /**
   * 从磁盘加载配置文件
   */
  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }

      if (!fs.existsSync(CONFIG_FILE)) {
        this.cache = this.createDefaultConfig();
        this.dirty = true;
        this.saveToDisk();
        this.dirty = false;
        return;
      }

      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(content) as AppConfig;

      // 确保所有默认 provider 都存在
      for (const [id, info] of Object.entries(DEFAULT_PROVIDERS)) {
        if (!config.providers[id as ProviderType]) {
          config.providers[id as ProviderType] = {
            envVar: info.envVar,
            currentKey: null,
            keys: [],
          };
        }
      }

      this.cache = config;
    } catch (error) {
      logger.error('Failed to load config from disk', error);
      this.cache = this.createDefaultConfig();
    }
  }

  /**
   * 将配置写入磁盘，写入前先创建备份
   */
  private saveToDisk(): void {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }

      // 创建备份
      if (fs.existsSync(CONFIG_FILE)) {
        try {
          fs.copyFileSync(CONFIG_FILE, CONFIG_BACKUP_FILE);
        } catch (backupError) {
          logger.warn('Failed to create config backup', backupError);
        }
      }

      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.cache, null, 2), 'utf-8');
      logger.debug('Config saved to disk');
    } catch (error) {
      logger.error('Failed to save config to disk', error);
    }
  }

  /**
   * 调度延迟写入
   */
  private scheduleFlush(): void {
    this.clearFlushTimer();
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, FLUSH_DELAY_MS);
  }

  /**
   * 清除延迟写入定时器
   */
  private clearFlushTimer(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * 创建默认配置
   */
  private createDefaultConfig(): AppConfig {
    const providers = {} as Record<ProviderType, { envVar: string; currentKey: null; keys: never[] }>;

    for (const [id, info] of Object.entries(DEFAULT_PROVIDERS)) {
      providers[id as ProviderType] = {
        envVar: info.envVar,
        currentKey: null,
        keys: [],
      };
    }

    return {
      version: '1.0',
      providers,
    };
  }
}

// 单例实例
let instance: ConfigCache | null = null;

/**
 * 获取 ConfigCache 单例
 */
export function getConfigCache(): ConfigCache {
  if (instance === null) {
    instance = new ConfigCache();
  }
  return instance;
}

/**
 * 重置单例（用于测试）
 */
export function resetConfigCache(): void {
  if (instance !== null) {
    instance.dispose();
    instance = null;
  }
}
