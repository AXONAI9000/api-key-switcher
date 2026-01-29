/**
 * WebDAV 同步后端
 * 支持坚果云、Nextcloud 等 WebDAV 服务
 */

import type {
  SyncBackendType,
  ServerStatus,
  PullResult,
  PushResult,
  EncryptedPackage,
  WebDAVSyncConfig,
} from '../types';
import {
  BaseSyncBackend,
  BackendConnectionError,
  BackendAuthError,
  BackendDataError,
} from './base';

// 请求超时（毫秒）
const REQUEST_TIMEOUT = 30000;

// 配置文件名
const CONFIG_FILENAME = 'api-key-switcher-config.json';

/**
 * WebDAV 同步后端实现
 */
export class WebDAVSyncBackend extends BaseSyncBackend {
  readonly type: SyncBackendType = 'webdav';

  private config: WebDAVSyncConfig;
  private deviceId: string;

  constructor(config: WebDAVSyncConfig, deviceId: string) {
    super();
    this.config = config;
    this.deviceId = deviceId;
  }

  /**
   * 获取基础 URL（确保没有尾部斜杠）
   */
  private get baseUrl(): string {
    return this.config.url.replace(/\/+$/, '');
  }

  /**
   * 获取配置文件完整路径
   */
  private get configFilePath(): string {
    const path = this.config.path.replace(/^\/+|\/+$/g, '');
    return path ? `${path}/${CONFIG_FILENAME}` : CONFIG_FILENAME;
  }

  /**
   * 获取配置文件完整 URL
   */
  private get configFileUrl(): string {
    return `${this.baseUrl}/${this.configFilePath}`;
  }

  /**
   * 获取认证头（Basic Auth）
   */
  private get authHeaders(): Record<string, string> {
    const credentials = Buffer.from(
      `${this.config.username}:${this.config.password}`
    ).toString('base64');

    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * 发送 WebDAV 请求
   */
  private async request(
    method: string,
    url: string,
    body?: string,
    additionalHeaders?: Record<string, string>
  ): Promise<{ ok: boolean; status: number; text?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const headers = { ...this.authHeaders, ...additionalHeaders };

      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let text: string | undefined;
      try {
        text = await response.text();
      } catch {
        // 忽略文本读取错误
      }

      return { ok: response.ok, status: response.status, text };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new BackendConnectionError('Request timeout', this.type);
        }
        throw new BackendConnectionError(error.message, this.type);
      }
      throw new BackendConnectionError('Unknown error', this.type);
    }
  }

  /**
   * 连接到 WebDAV 服务器
   */
  async connect(): Promise<boolean> {
    try {
      // 使用 PROPFIND 检查连接和认证
      const response = await this.request(
        'PROPFIND',
        this.baseUrl,
        undefined,
        { 'Depth': '0' }
      );

      if (response.status === 401 || response.status === 403) {
        throw new BackendAuthError('Invalid WebDAV credentials', this.type);
      }

      if (!response.ok && response.status !== 207) {
        throw new BackendConnectionError(
          `WebDAV server error: ${response.status}`,
          this.type,
          response.status
        );
      }

      // 确保目录存在
      await this.ensureDirectory();

      this.connected = true;
      return true;
    } catch (error) {
      this.connected = false;
      throw error;
    }
  }

  /**
   * 确保存储目录存在
   */
  private async ensureDirectory(): Promise<void> {
    if (!this.config.path || this.config.path === '/') {
      return;
    }

    const pathParts = this.config.path.replace(/^\/+|\/+$/g, '').split('/');
    let currentPath = this.baseUrl;

    for (const part of pathParts) {
      currentPath = `${currentPath}/${part}`;

      // 检查目录是否存在
      const checkResponse = await this.request(
        'PROPFIND',
        currentPath,
        undefined,
        { 'Depth': '0' }
      );

      if (checkResponse.status === 404) {
        // 创建目录
        const mkcolResponse = await this.request('MKCOL', currentPath);

        if (!mkcolResponse.ok && mkcolResponse.status !== 201 && mkcolResponse.status !== 405) {
          throw new BackendDataError(
            `Failed to create directory: ${currentPath}`,
            this.type
          );
        }
      }
    }
  }

  /**
   * 获取状态
   */
  async getStatus(): Promise<ServerStatus> {
    try {
      // 检查配置文件是否存在
      const response = await this.request(
        'PROPFIND',
        this.configFileUrl,
        undefined,
        { 'Depth': '0' }
      );

      if (response.status === 401 || response.status === 403) {
        throw new BackendAuthError('Invalid WebDAV credentials', this.type);
      }

      const hasData = response.ok || response.status === 207;

      // 尝试获取最后修改时间
      let lastUpdated: string | undefined;
      if (hasData && response.text) {
        const lastModMatch = response.text.match(/<d:getlastmodified>([^<]+)<\/d:getlastmodified>/i);
        if (lastModMatch) {
          lastUpdated = new Date(lastModMatch[1]).toISOString();
        }
      }

      return {
        connected: true,
        hasData,
        lastUpdated,
      };
    } catch (error) {
      if (error instanceof BackendAuthError) {
        throw error;
      }
      throw new BackendConnectionError(
        error instanceof Error ? error.message : 'Unknown error',
        this.type
      );
    }
  }

  /**
   * 从 WebDAV 拉取配置
   */
  async pull(): Promise<PullResult> {
    try {
      const response = await this.request('GET', this.configFileUrl);

      if (response.status === 401 || response.status === 403) {
        throw new BackendAuthError('Invalid WebDAV credentials', this.type);
      }

      if (response.status === 404) {
        return { success: true, notFound: true };
      }

      if (!response.ok) {
        throw new BackendDataError(
          `Failed to pull from WebDAV: ${response.status}`,
          this.type
        );
      }

      if (!response.text) {
        return { success: true, notFound: true };
      }

      try {
        const content = JSON.parse(response.text);

        // 检查是否是有效的加密数据包
        if (!content.encryptedData) {
          return { success: true, notFound: true };
        }

        return {
          success: true,
          data: content as EncryptedPackage,
        };
      } catch {
        return { success: true, notFound: true };
      }
    } catch (error) {
      if (error instanceof BackendAuthError || error instanceof BackendDataError) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 推送配置到 WebDAV
   */
  async push(data: EncryptedPackage): Promise<PushResult> {
    try {
      const content = JSON.stringify(data, null, 2);

      const response = await this.request('PUT', this.configFileUrl, content);

      if (response.status === 401 || response.status === 403) {
        throw new BackendAuthError('Invalid WebDAV credentials', this.type);
      }

      if (!response.ok && response.status !== 201 && response.status !== 204) {
        throw new BackendDataError(
          `Failed to push to WebDAV: ${response.status}`,
          this.type
        );
      }

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof BackendAuthError || error instanceof BackendDataError) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: WebDAVSyncConfig): void {
    this.config = config;
    this.connected = false;
  }
}

/**
 * WebDAV 预设服务商配置
 */
export const WEBDAV_PRESETS: Record<string, Partial<WebDAVSyncConfig>> = {
  jianguoyun: {
    url: 'https://dav.jianguoyun.com/dav',
    path: '/api-key-switcher',
  },
  nextcloud: {
    path: '/remote.php/dav/files/{username}/api-key-switcher',
  },
  box: {
    url: 'https://dav.box.com/dav',
    path: '/api-key-switcher',
  },
};
