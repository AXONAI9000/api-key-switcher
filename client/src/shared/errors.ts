// 错误码枚举
export enum ErrorCode {
  // 通用
  UNKNOWN = 'UNKNOWN',

  // 配置相关
  CONFIG_LOAD_FAILED = 'CONFIG_LOAD_FAILED',
  CONFIG_SAVE_FAILED = 'CONFIG_SAVE_FAILED',
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_BACKUP_FAILED = 'CONFIG_BACKUP_FAILED',

  // Key 相关
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
  KEY_ALREADY_EXISTS = 'KEY_ALREADY_EXISTS',
  KEY_DISABLED = 'KEY_DISABLED',
  KEY_INVALID = 'KEY_INVALID',
  KEY_EXPIRED = 'KEY_EXPIRED',
  KEY_RATE_LIMITED = 'KEY_RATE_LIMITED',
  KEY_QUOTA_EXCEEDED = 'KEY_QUOTA_EXCEEDED',

  // 验证相关
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  PROVIDER_UNKNOWN = 'PROVIDER_UNKNOWN',

  // 同步相关
  SYNC_PUSH_FAILED = 'SYNC_PUSH_FAILED',
  SYNC_PULL_FAILED = 'SYNC_PULL_FAILED',
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  SYNC_AUTH_FAILED = 'SYNC_AUTH_FAILED',
  SYNC_NETWORK_ERROR = 'SYNC_NETWORK_ERROR',

  // 环境变量相关
  ENV_SET_FAILED = 'ENV_SET_FAILED',
  ENV_READ_FAILED = 'ENV_READ_FAILED',
}

// 基础应用错误
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly cause?: Error;
  public readonly timestamp: string;

  constructor(message: string, code: ErrorCode, cause?: Error) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
    this.timestamp = new Date().toISOString();

    // 修复 TypeScript 中继承 Error 的原型链问题
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      cause: this.cause
        ? { name: this.cause.name, message: this.cause.message }
        : undefined,
    };
  }
}

// 配置错误
export class ConfigError extends AppError {
  constructor(message: string, code: ErrorCode, cause?: Error) {
    super(message, code, cause);
    this.name = 'ConfigError';
  }
}

// 同步错误
export class SyncError extends AppError {
  constructor(message: string, code: ErrorCode, cause?: Error) {
    super(message, code, cause);
    this.name = 'SyncError';
  }
}

// 验证错误
export class ValidationError extends AppError {
  constructor(message: string, code: ErrorCode, cause?: Error) {
    super(message, code, cause);
    this.name = 'ValidationError';
  }
}

// Key 验证错误
export class KeyValidationError extends AppError {
  public readonly provider: string;

  constructor(message: string, code: ErrorCode, provider: string, cause?: Error) {
    super(message, code, cause);
    this.name = 'KeyValidationError';
    this.provider = provider;
  }
}
