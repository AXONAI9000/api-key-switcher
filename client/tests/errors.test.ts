import { describe, it, expect } from 'vitest';
import {
  AppError,
  ConfigError,
  SyncError,
  ValidationError,
  KeyValidationError,
  ErrorCode,
} from '../src/shared/errors';

describe('错误类型', () => {
  describe('AppError', () => {
    it('应该创建带 code 的基础错误', () => {
      const err = new AppError('test error', ErrorCode.UNKNOWN);
      expect(err.message).toBe('test error');
      expect(err.code).toBe(ErrorCode.UNKNOWN);
      expect(err.name).toBe('AppError');
      expect(err instanceof Error).toBe(true);
    });

    it('应该支持 cause 链', () => {
      const cause = new Error('root cause');
      const err = new AppError('wrapper', ErrorCode.UNKNOWN, cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe('ConfigError', () => {
    it('应该创建配置错误', () => {
      const err = new ConfigError('load failed', ErrorCode.CONFIG_LOAD_FAILED);
      expect(err.name).toBe('ConfigError');
      expect(err.code).toBe(ErrorCode.CONFIG_LOAD_FAILED);
    });
  });

  describe('SyncError', () => {
    it('应该创建同步错误', () => {
      const err = new SyncError('sync failed', ErrorCode.SYNC_PUSH_FAILED);
      expect(err.name).toBe('SyncError');
    });
  });

  describe('ValidationError', () => {
    it('应该创建验证错误', () => {
      const err = new ValidationError('invalid key', ErrorCode.VALIDATION_FAILED);
      expect(err.name).toBe('ValidationError');
    });
  });

  describe('KeyValidationError', () => {
    it('应该创建 Key 验证错误并携带 provider', () => {
      const err = new KeyValidationError('invalid', ErrorCode.KEY_INVALID, 'claude');
      expect(err.name).toBe('KeyValidationError');
      expect(err.provider).toBe('claude');
    });
  });
});
