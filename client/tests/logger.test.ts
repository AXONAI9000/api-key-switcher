import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger, LogLevel, setGlobalLogLevel } from '../src/shared/logger';

describe('日志系统', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('TestModule');
    setGlobalLogLevel(LogLevel.DEBUG);
  });

  describe('日志级别', () => {
    it('应该按级别过滤日志', () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      setGlobalLogLevel(LogLevel.WARN);
      logger.debug('should not appear');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('应该输出高于当前级别的日志', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setGlobalLogLevel(LogLevel.WARN);
      logger.error('should appear');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('敏感信息脱敏', () => {
    it('应该脱敏 API Key', () => {
      const sanitized = Logger.sanitize('my key is sk-ant-api03-abcdefghijklmnop');
      expect(sanitized).not.toContain('abcdefghijklmnop');
      expect(sanitized).toContain('sk-ant-***');
    });

    it('应该脱敏 Bearer Token', () => {
      const sanitized = Logger.sanitize('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test');
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(sanitized).toContain('Bearer ***');
    });

    it('应该脱敏密码字段', () => {
      const sanitized = Logger.sanitize(JSON.stringify({ password: 'secret123', email: 'test@test.com' }));
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).toContain('test@test.com');
    });
  });

  describe('上下文信息', () => {
    it('应该包含模块名称', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('test message');
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('[TestModule]'),
        expect.anything()
      );
      spy.mockRestore();
    });
  });
});
