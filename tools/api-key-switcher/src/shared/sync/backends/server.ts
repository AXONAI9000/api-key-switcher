/**
 * 自建服务器同步后端
 */

import type {
  SyncBackendType,
  ServerStatus,
  PullResult,
  PushResult,
  EncryptedPackage,
  ServerSyncConfig,
} from '../types';
import {
  BaseSyncBackend,
  BackendConnectionError,
  BackendAuthError,
  BackendDataError,
} from './base';
import { authService } from '../auth-service';

// HTTP 请求超时（毫秒）
const REQUEST_TIMEOUT = 30000;

/**
 * HTTP 响应接口
 */
interface HttpResponse<T = unknown> {
  ok: boolean;
  status: number;
  statusText: string;
  data?: T;
}

/**
 * 服务器状态响应
 */
interface ServerStatusResponse {
  connected: boolean;
  hasData: boolean;
  lastUpdated?: string;
  deviceId?: string;
  version?: number;
}

/**
 * 服务器配置响应
 */
interface ServerConfigResponse {
  data: EncryptedPackage;
}

/**
 * 服务器推送响应
 */
interface ServerPushResponse {
  success: boolean;
  timestamp: string;
}

/**
 * 自建服务器同步后端实现
 */
export class ServerSyncBackend extends BaseSyncBackend {
  readonly type: SyncBackendType = 'server';

  private config: ServerSyncConfig;
  private deviceId: string;

  constructor(config: ServerSyncConfig, deviceId: string) {
    super();
    this.config = config;
    this.deviceId = deviceId;
    // 配置 AuthService
    authService.configure(config.url, deviceId);
  }

  /**
   * 获取基础 URL（确保没有尾部斜杠）
   */
  private get baseUrl(): string {
    return this.config.url.replace(/\/+$/, '');
  }

  /**
   * 获取认证头
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const accessToken = await authService.getAccessToken();
    if (!accessToken) {
      throw new BackendAuthError('未登录，请先登录', this.type);
    }
    return {
      'Authorization': `Bearer ${accessToken}`,
      'X-Device-Id': this.deviceId,
      'Content-Type': 'application/json',
    };
  }

  /**
   * 发送 HTTP 请求
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<HttpResponse<T>> {
    const url = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: T | undefined;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        try {
          data = await response.json() as T;
        } catch {
          // JSON 解析失败，忽略
        }
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof BackendAuthError) {
        throw error;
      }

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
   * 检查是否已认证
   */
  isAuthenticated(): boolean {
    return authService.isAuthenticated();
  }

  /**
   * 连接到服务器
   */
  async connect(): Promise<boolean> {
    // 检查是否已登录
    if (!authService.isAuthenticated()) {
      throw new BackendAuthError('未登录，请先登录', this.type);
    }

    try {
      // 尝试获取状态来验证连接
      const response = await this.request<ServerStatusResponse>(
        'GET',
        '/api/v1/sync/status'
      );

      if (response.status === 401) {
        throw new BackendAuthError('认证失败，请重新登录', this.type);
      }

      if (!response.ok) {
        throw new BackendConnectionError(
          `Server returned ${response.status}: ${response.statusText}`,
          this.type,
          response.status
        );
      }

      this.connected = true;
      return true;
    } catch (error) {
      this.connected = false;
      throw error;
    }
  }

  /**
   * 获取服务器状态
   */
  async getStatus(): Promise<ServerStatus> {
    try {
      const response = await this.request<ServerStatusResponse>(
        'GET',
        '/api/v1/sync/status'
      );

      if (response.status === 401) {
        throw new BackendAuthError('认证失败，请重新登录', this.type);
      }

      if (!response.ok || !response.data) {
        throw new BackendConnectionError(
          `Failed to get status: ${response.statusText}`,
          this.type,
          response.status
        );
      }

      return {
        connected: true,
        hasData: response.data.hasData,
        lastUpdated: response.data.lastUpdated,
        deviceId: response.data.deviceId,
        version: response.data.version,
      };
    } catch (error) {
      if (error instanceof BackendAuthError || error instanceof BackendConnectionError) {
        throw error;
      }
      throw new BackendConnectionError(
        error instanceof Error ? error.message : 'Unknown error',
        this.type
      );
    }
  }

  /**
   * 从服务器拉取配置
   */
  async pull(): Promise<PullResult> {
    try {
      const response = await this.request<ServerConfigResponse>(
        'GET',
        '/api/v1/sync/config'
      );

      if (response.status === 401) {
        throw new BackendAuthError('认证失败，请重新登录', this.type);
      }

      if (response.status === 404) {
        return {
          success: true,
          notFound: true,
        };
      }

      if (!response.ok || !response.data) {
        throw new BackendDataError(
          `Failed to pull config: ${response.statusText}`,
          this.type
        );
      }

      return {
        success: true,
        data: response.data.data,
      };
    } catch (error) {
      if (error instanceof BackendAuthError ||
          error instanceof BackendConnectionError ||
          error instanceof BackendDataError) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 推送配置到服务器
   */
  async push(data: EncryptedPackage): Promise<PushResult> {
    try {
      const response = await this.request<ServerPushResponse>(
        'PUT',
        '/api/v1/sync/config',
        { data }
      );

      if (response.status === 401) {
        throw new BackendAuthError('认证失败，请重新登录', this.type);
      }

      if (!response.ok) {
        throw new BackendDataError(
          `Failed to push config: ${response.statusText}`,
          this.type
        );
      }

      return {
        success: true,
        timestamp: response.data?.timestamp ?? new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof BackendAuthError ||
          error instanceof BackendConnectionError ||
          error instanceof BackendDataError) {
        return {
          success: false,
          error: error.message,
        };
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
  updateConfig(config: ServerSyncConfig): void {
    this.config = config;
    this.connected = false;
    // 重新配置 AuthService
    authService.configure(config.url, this.deviceId);
  }
}
