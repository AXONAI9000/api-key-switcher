import { describe, it, expect } from 'vitest';
import {
  encryptConfig,
  decryptConfig,
  generateChecksum,
  validateEncryptedPackage,
  validatePasswordStrength,
  hashMasterPassword,
  verifyMasterPassword,
} from '../src/shared/sync/crypto';
import type { AppConfig } from '../src/shared/types';

function createTestConfig(): AppConfig {
  return {
    version: '1.0',
    providers: {
      claude: {
        envVar: 'ANTHROPIC_AUTH_TOKEN',
        currentKey: 'test-key',
        keys: [{
          alias: 'test-key',
          key: 'sk-ant-test-key-12345',
          enabled: true,
          createdAt: '2025-01-01T00:00:00.000Z',
        }],
      },
      openai: { envVar: 'OPENAI_API_KEY', currentKey: null, keys: [] },
      gemini: { envVar: 'GOOGLE_API_KEY', currentKey: null, keys: [] },
      deepseek: { envVar: 'DEEPSEEK_API_KEY', currentKey: null, keys: [] },
      custom: { envVar: 'CUSTOM_API_KEY', currentKey: null, keys: [] },
    },
  };
}

describe('同步集成测试', () => {
  describe('加密解密完整流程', () => {
    it('加密后解密应该得到原始配置', async () => {
      const config = createTestConfig();
      const password = 'TestPassword123!';
      const deviceId = 'test-device-001';

      const encrypted = await encryptConfig(config, password, deviceId);
      const decrypted = await decryptConfig(encrypted, password);

      expect(decrypted.version).toBe(config.version);
      expect(decrypted.providers.claude.currentKey).toBe('test-key');
      expect(decrypted.providers.claude.keys[0].key).toBe('sk-ant-test-key-12345');
    });

    it('使用错误密码解密应该失败', async () => {
      const config = createTestConfig();
      const encrypted = await encryptConfig(config, 'correct-password-123', 'device-1');

      await expect(decryptConfig(encrypted, 'wrong-password-456')).rejects.toThrow();
    });

    it('加密包应该通过验证', async () => {
      const config = createTestConfig();
      const encrypted = await encryptConfig(config, 'TestPassword123!', 'device-1');

      expect(validateEncryptedPackage(encrypted)).toBe(true);
    });

    it('不完整的加密包应该验证失败', () => {
      const incomplete = {
        encryptedData: 'abc',
        iv: '',
        salt: 'def',
        checksum: 'ghi',
        version: 1,
        timestamp: new Date().toISOString(),
        deviceId: 'test',
      };
      expect(validateEncryptedPackage(incomplete)).toBe(false);
    });

    it('加密包应该包含正确的 deviceId', async () => {
      const config = createTestConfig();
      const encrypted = await encryptConfig(config, 'TestPassword123!', 'my-device-id');
      expect(encrypted.deviceId).toBe('my-device-id');
    });

    it('每次加密应该产生不同的结果（随机 IV 和 salt）', async () => {
      const config = createTestConfig();
      const password = 'TestPassword123!';

      const encrypted1 = await encryptConfig(config, password, 'device-1');
      const encrypted2 = await encryptConfig(config, password, 'device-1');

      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
    });
  });

  describe('校验和', () => {
    it('相同数据应该产生相同校验和', () => {
      const data = 'hello world';
      expect(generateChecksum(data)).toBe(generateChecksum(data));
    });

    it('不同数据应该产生不同校验和', () => {
      expect(generateChecksum('hello')).not.toBe(generateChecksum('world'));
    });

    it('校验和应该是 64 字符的十六进制字符串', () => {
      const checksum = generateChecksum('test data');
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('密码强度验证', () => {
    it('短密码应该无效', () => {
      const result = validatePasswordStrength('short');
      expect(result.valid).toBe(false);
      expect(result.feedback.length).toBeGreaterThan(0);
    });

    it('强密码应该有效且高分', () => {
      const result = validatePasswordStrength('MyStr0ng!Pass@2025');
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3);
    });

    it('8 字符密码应该有效', () => {
      const result = validatePasswordStrength('12345678');
      expect(result.valid).toBe(true);
    });
  });

  describe('主密码哈希', () => {
    it('哈希后验证应该成功', async () => {
      const password = 'MySecretPassword123!';
      const { hash, salt } = await hashMasterPassword(password);
      const isValid = await verifyMasterPassword(password, hash, salt);
      expect(isValid).toBe(true);
    });

    it('错误密码验证应该失败', async () => {
      const { hash, salt } = await hashMasterPassword('correct-password');
      const isValid = await verifyMasterPassword('wrong-password', hash, salt);
      expect(isValid).toBe(false);
    });

    it('相同密码不同 salt 应该产生不同哈希', async () => {
      const password = 'same-password';
      const result1 = await hashMasterPassword(password);
      const result2 = await hashMasterPassword(password);
      expect(result1.hash).not.toBe(result2.hash);
      expect(result1.salt).not.toBe(result2.salt);
    });
  });

  describe('冲突检测模拟', () => {
    it('相同配置的校验和应该相同', () => {
      const config1 = createTestConfig();
      const config2 = createTestConfig();
      expect(generateChecksum(JSON.stringify(config1))).toBe(generateChecksum(JSON.stringify(config2)));
    });

    it('修改后的配置校验和应该不同', () => {
      const config1 = createTestConfig();
      const config2 = createTestConfig();
      config2.providers.claude.keys.push({
        alias: 'new-key',
        key: 'sk-new-key-value',
        enabled: true,
        createdAt: '2025-01-02T00:00:00.000Z',
      });
      expect(generateChecksum(JSON.stringify(config1))).not.toBe(generateChecksum(JSON.stringify(config2)));
    });
  });
});
