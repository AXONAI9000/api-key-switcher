/**
 * 同步后端抽象基类
 */

import type {
  SyncBackendType,
  ISyncBackend,
  ServerStatus,
  PullResult,
  PushResult,
  EncryptedPackage,
} from '../types';

// 重试配置
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1秒
const MAX_RETRY_DELAY = 8000; // 8秒
const REQUEST_TIMEOUT = 30000; // 30秒

/**
 * 延迟执行
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 计算指数退避延迟
 */
function getRetryDelay(attempt: number): number {
  const delayMs = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
  return Math.min(delayMs, MAX_RETRY_DELAY);
}

/**
 * 判断 HTTP 状态码是否应该重试
 */
function shouldRetry(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

/**
 * 通用 HTTP 响应接口
 */
export interface HttpResponse<T = unknown> {
  ok: boolean;
  status: number;
  statusText: string;
  data?: T;
  text?: string;
}

/**
 * 同步后端抽象基类
 * 所有具体后端实现都应该继承此类
 */
export abstract class BaseSyncBackend implements ISyncBackend {
  abstract readonly type: SyncBackendType;

  protected connected: boolean = false;

  /**
   * 连接到后端服务
   * @returns 是否连接成功
   */
  abstract connect(): Promise<boolean>;

  /**
   * 获取服务器状态
   * @returns 服务器状态信息
   */
  abstract getStatus(): Promise<ServerStatus>;

  /**
   * 从后端拉取配置
   * @returns 拉取结果
   */
  abstract pull(): Promise<PullResult>;

  /**
   * 推送配置到后端
   * @param data 加密数据包
   * @returns 推送结果
   */
  abstract push(data: EncryptedPackage): Promise<PushResult>;

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 获取请求头（子类实现）
   */
  protected abstract getRequestHeaders(): Record<string, string> | Promise<Record<string, string>>;

  /**
   * 带重试的 HTTP 请求
   * 支持指数退避重试，对 5xx、408、429 状态码自动重试
   */
  protected async fetchWithRetry<T>(
    method: string,
    url: string,
    options?: {
      body?: string;
      headers?: Record<string, string>;
      parseJson?: boolean;
    }
  ): Promise<HttpResponse<T>> {
    const parseJson = options?.parseJson !== false;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const baseHeaders = await this.getRequestHeaders();
        const headers = { ...baseHeaders, ...options?.headers };

        const response = await fetch(url, {
          method,
          headers,
          body: options?.body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 如果是可重试的错误且还有重试次数
        if (!response.ok && shouldRetry(response.status) && attempt < MAX_RETRIES) {
          const retryMs = getRetryDelay(attempt);
          console.log(`Request failed with ${response.status}, retrying in ${retryMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await delay(retryMs);
          continue;
        }

        let data: T | undefined;
        let text: string | undefined;

        if (parseJson) {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            try {
              data = await response.json() as T;
            } catch {
              // JSON 解析失败，忽略
            }
          }
        } else {
          try {
            text = await response.text();
          } catch {
            // 文本读取失败，忽略
          }
        }

        return {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          data,
          text,
        };
      } catch (error) {
        clearTimeout(timeoutId);

        // 认证错误不重试，直接抛出
        if (error instanceof BackendAuthError) {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error('Unknown error');

        // 网络错误可以重试
        if (attempt < MAX_RETRIES) {
          const retryMs = getRetryDelay(attempt);
          console.log(`Network error: ${lastError.message}, retrying in ${retryMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await delay(retryMs);
          continue;
        }
      }
    }

    // 所有重试都失败
    if (lastError?.name === 'AbortError') {
      throw new BackendConnectionError('Request timeout after retries', this.type);
    }
    throw new BackendConnectionError(
      lastError?.message || 'Request failed after retries',
      this.type
    );
  }
}

/**
 * 后端连接错误
 */
export class BackendConnectionError extends Error {
  constructor(
    message: string,
    public readonly backendType: SyncBackendType,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'BackendConnectionError';
  }
}

/**
 * 后端认证错误
 */
export class BackendAuthError extends Error {
  constructor(
    message: string,
    public readonly backendType: SyncBackendType
  ) {
    super(message);
    this.name = 'BackendAuthError';
  }
}

/**
 * 后端数据错误
 */
export class BackendDataError extends Error {
  constructor(
    message: string,
    public readonly backendType: SyncBackendType
  ) {
    super(message);
    this.name = 'BackendDataError';
  }
}
