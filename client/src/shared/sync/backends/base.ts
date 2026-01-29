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
