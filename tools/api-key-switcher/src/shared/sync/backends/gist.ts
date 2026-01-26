/**
 * GitHub Gist 同步后端
 */

import type {
  SyncBackendType,
  ServerStatus,
  PullResult,
  PushResult,
  EncryptedPackage,
  GistSyncConfig,
} from '../types';
import {
  BaseSyncBackend,
  BackendConnectionError,
  BackendAuthError,
  BackendDataError,
} from './base';

// GitHub API 基础 URL
const GITHUB_API_BASE = 'https://api.github.com';

// 请求超时（毫秒）
const REQUEST_TIMEOUT = 30000;

// Gist 文件名
const GIST_FILENAME = 'api-key-switcher-config.json';

// Gist 描述
const GIST_DESCRIPTION = 'API Key Switcher - Encrypted Configuration (Do not edit manually)';

/**
 * GitHub Gist 响应类型
 */
interface GistResponse {
  id: string;
  description: string;
  files: Record<string, {
    filename: string;
    content: string;
    size: number;
    raw_url: string;
  }>;
  created_at: string;
  updated_at: string;
  owner?: {
    login: string;
    id: number;
  };
}

/**
 * GitHub 用户响应类型
 */
interface GitHubUserResponse {
  login: string;
  id: number;
}

/**
 * GitHub Gist 同步后端实现
 */
export class GistSyncBackend extends BaseSyncBackend {
  readonly type: SyncBackendType = 'gist';

  private config: GistSyncConfig;
  private deviceId: string;
  private resolvedGistId?: string;

  constructor(config: GistSyncConfig, deviceId: string) {
    super();
    this.config = config;
    this.deviceId = deviceId;
    this.resolvedGistId = config.gistId;
  }

  /**
   * 获取认证头
   */
  private get authHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };
  }

  /**
   * 发送 GitHub API 请求
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ ok: boolean; status: number; data?: T }> {
    const url = `${GITHUB_API_BASE}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method,
        headers: this.authHeaders,
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
          // JSON 解析失败
        }
      }

      return { ok: response.ok, status: response.status, data };
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
   * 连接到 GitHub（验证 Token）
   */
  async connect(): Promise<boolean> {
    try {
      const response = await this.request<GitHubUserResponse>('GET', '/user');

      if (response.status === 401) {
        throw new BackendAuthError('Invalid GitHub token', this.type);
      }

      if (!response.ok) {
        throw new BackendConnectionError(
          `GitHub API error: ${response.status}`,
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
   * 获取或创建 Gist
   */
  private async ensureGist(): Promise<string> {
    if (this.resolvedGistId) {
      return this.resolvedGistId;
    }

    // 查找现有的 Gist
    const existingGist = await this.findExistingGist();
    if (existingGist) {
      this.resolvedGistId = existingGist;
      return existingGist;
    }

    // 创建新 Gist
    const newGistId = await this.createGist();
    this.resolvedGistId = newGistId;
    return newGistId;
  }

  /**
   * 查找现有的配置 Gist
   */
  private async findExistingGist(): Promise<string | null> {
    const response = await this.request<GistResponse[]>('GET', '/gists?per_page=100');

    if (!response.ok || !response.data) {
      return null;
    }

    const configGist = response.data.find(
      gist => gist.files[GIST_FILENAME] !== undefined
    );

    return configGist?.id ?? null;
  }

  /**
   * 创建新的 Gist
   */
  private async createGist(): Promise<string> {
    const response = await this.request<GistResponse>('POST', '/gists', {
      description: GIST_DESCRIPTION,
      public: false,
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify({ initialized: true, deviceId: this.deviceId }),
        },
      },
    });

    if (!response.ok || !response.data) {
      throw new BackendDataError('Failed to create Gist', this.type);
    }

    return response.data.id;
  }

  /**
   * 获取状态
   */
  async getStatus(): Promise<ServerStatus> {
    try {
      const gistId = await this.ensureGist();
      const response = await this.request<GistResponse>('GET', `/gists/${gistId}`);

      if (response.status === 401) {
        throw new BackendAuthError('Invalid GitHub token', this.type);
      }

      if (response.status === 404) {
        return {
          connected: true,
          hasData: false,
        };
      }

      if (!response.ok || !response.data) {
        throw new BackendConnectionError('Failed to get Gist status', this.type);
      }

      const file = response.data.files[GIST_FILENAME];
      const hasValidData = file && file.content.includes('encryptedData');

      return {
        connected: true,
        hasData: hasValidData,
        lastUpdated: response.data.updated_at,
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
   * 从 Gist 拉取配置
   */
  async pull(): Promise<PullResult> {
    try {
      const gistId = await this.ensureGist();
      const response = await this.request<GistResponse>('GET', `/gists/${gistId}`);

      if (response.status === 401) {
        throw new BackendAuthError('Invalid GitHub token', this.type);
      }

      if (response.status === 404) {
        return { success: true, notFound: true };
      }

      if (!response.ok || !response.data) {
        throw new BackendDataError('Failed to pull from Gist', this.type);
      }

      const file = response.data.files[GIST_FILENAME];
      if (!file) {
        return { success: true, notFound: true };
      }

      try {
        const content = JSON.parse(file.content);

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
   * 推送配置到 Gist
   */
  async push(data: EncryptedPackage): Promise<PushResult> {
    try {
      const gistId = await this.ensureGist();

      const response = await this.request<GistResponse>('PATCH', `/gists/${gistId}`, {
        description: GIST_DESCRIPTION,
        files: {
          [GIST_FILENAME]: {
            content: JSON.stringify(data, null, 2),
          },
        },
      });

      if (response.status === 401) {
        throw new BackendAuthError('Invalid GitHub token', this.type);
      }

      if (!response.ok) {
        throw new BackendDataError('Failed to push to Gist', this.type);
      }

      return {
        success: true,
        timestamp: response.data?.updated_at ?? new Date().toISOString(),
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
  updateConfig(config: GistSyncConfig): void {
    this.config = config;
    this.resolvedGistId = config.gistId;
    this.connected = false;
  }

  /**
   * 获取当前 Gist ID
   */
  getGistId(): string | undefined {
    return this.resolvedGistId;
  }
}
