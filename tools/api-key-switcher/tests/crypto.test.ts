/**
 * 加密模块单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  deriveEncryptionKey,
  encryptConfig,
  decryptConfig,
  generateChecksum,
  validateEncryptedPackage,
  validatePasswordStrength,
  generateDeviceId,
  hashMasterPassword,
  verifyMasterPassword,
} from '../src/shared/sync/crypto';
import type { AppConfig } from '../src/shared/types';
import type { EncryptedPackage } from '../src/shared/sync/types';

// 测试用配置
const testConfig: AppConfig = {
  version: '1.0.0',
  providers: {
    claude: {
      envVar: 'ANTHROPIC_AUTH_TOKEN',
      currentKey: 'test-key',
      keys: [
        {
          alias: 'test-key',
          key: 'sk-ant-test-key-12345',
          enabled: true,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    },
    openai: {
      envVar: 'OPENAI_API_KEY',
      currentKey: null,
      keys: [],
    },
    gemini: {
      envVar: 'GOOGLE_API_KEY',
      currentKey: null,
      keys: [],
    },
    deepseek: {
      envVar: 'DEEPSEEK_API_KEY',
      currentKey: null,
      keys: [],
    },
    custom: {
      envVar: 'CUSTOM_API_KEY',
      currentKey: null,
      keys: [],
    },
  },
};

describe('加密模块', () => {
  describe('deriveEncryptionKey', () => {
    it('应该从密码派生密钥', async () => {
      const password = 'test-password-123';
      const result = await deriveEncryptionKey(password);

      expect(result.key).toBeDefined();
      expect(result.salt).toBeDefined();
      expect(result.key.length).toBe(32); // 256 bits
      expect(result.salt.length).toBe(32);
    });

    it('相同密码和盐值应该生成相同密钥', async () => {
      const password = 'test-password-123';
      const { key: key1, salt } = await deriveEncryptionKey(password);
      const { key: key2 } = await deriveEncryptionKey(password, salt);

      expect(key1.equals(key2)).toBe(true);
    });

    it('不同密码应该生成不同密钥', async () => {
      const { key: key1, salt } = await deriveEncryptionKey('password1');
      const { key: key2 } = await deriveEncryptionKey('password2', salt);

      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('encryptConfig / decryptConfig', () => {
    it('应该正确加密和解密配置', async () => {
      const password = 'secure-password-123';
      const deviceId = 'test-device-001';

      const encrypted = await encryptConfig(testConfig, password, deviceId);

      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.checksum).toBeDefined();
      expect(encrypted.deviceId).toBe(deviceId);

      const decrypted = await decryptConfig(encrypted, password);

      expect(decrypted).toEqual(testConfig);
    });

    it('错误密码应该解密失败', async () => {
      const password = 'correct-password';
      const wrongPassword = 'wrong-password';
      const deviceId = 'test-device-001';

      const encrypted = await encryptConfig(testConfig, password, deviceId);

      await expect(decryptConfig(encrypted, wrongPassword)).rejects.toThrow();
    });

    it('篡改数据应该校验失败', async () => {
      const password = 'secure-password-123';
      const deviceId = 'test-device-001';

      const encrypted = await encryptConfig(testConfig, password, deviceId);

      // 篡改校验和
      const tampered: EncryptedPackage = {
        ...encrypted,
        checksum: 'tampered-checksum',
      };

      await expect(decryptConfig(tampered, password)).rejects.toThrow('Checksum verification failed');
    });
  });

  describe('generateChecksum', () => {
    it('应该生成一致的校验和', () => {
      const data = 'test data for checksum';
      const checksum1 = generateChecksum(data);
      const checksum2 = generateChecksum(data);

      expect(checksum1).toBe(checksum2);
      expect(checksum1.length).toBe(64); // SHA-256 hex
    });

    it('不同数据应该生成不同校验和', () => {
      const checksum1 = generateChecksum('data1');
      const checksum2 = generateChecksum('data2');

      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('validateEncryptedPackage', () => {
    it('应该验证有效的加密包', async () => {
      const password = 'test-password';
      const deviceId = 'test-device';

      const encrypted = await encryptConfig(testConfig, password, deviceId);

      expect(validateEncryptedPackage(encrypted)).toBe(true);
    });

    it('应该拒绝缺少字段的包', () => {
      const invalidPackage = {
        encryptedData: 'test',
        iv: 'test',
        // 缺少其他字段
      } as EncryptedPackage;

      expect(validateEncryptedPackage(invalidPackage)).toBe(false);
    });

    it('应该拒绝无效版本的包', () => {
      const invalidPackage: EncryptedPackage = {
        encryptedData: 'test',
        iv: 'test',
        salt: 'test',
        checksum: 'test',
        version: 0, // 无效版本
        timestamp: new Date().toISOString(),
        deviceId: 'test',
      };

      expect(validateEncryptedPackage(invalidPackage)).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('应该拒绝过短的密码', () => {
      const result = validatePasswordStrength('short');

      expect(result.valid).toBe(false);
      expect(result.feedback).toContain('密码至少需要 8 个字符');
    });

    it('应该接受足够长的密码', () => {
      const result = validatePasswordStrength('longenoughpassword');

      expect(result.valid).toBe(true);
    });

    it('应该给强密码更高分数', () => {
      const weak = validatePasswordStrength('password');
      const strong = validatePasswordStrength('P@ssw0rd123!');

      expect(strong.score).toBeGreaterThan(weak.score);
    });
  });

  describe('generateDeviceId', () => {
    it('应该生成唯一的设备 ID', () => {
      const id1 = generateDeviceId();
      const id2 = generateDeviceId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^device_[a-f0-9]{32}$/);
    });
  });

  describe('hashMasterPassword / verifyMasterPassword', () => {
    it('应该正确哈希和验证密码', async () => {
      const password = 'my-master-password';

      const { hash, salt } = await hashMasterPassword(password);

      expect(hash).toBeDefined();
      expect(salt).toBeDefined();

      const isValid = await verifyMasterPassword(password, hash, salt);
      expect(isValid).toBe(true);
    });

    it('错误密码应该验证失败', async () => {
      const password = 'correct-password';
      const wrongPassword = 'wrong-password';

      const { hash, salt } = await hashMasterPassword(password);

      const isValid = await verifyMasterPassword(wrongPassword, hash, salt);
      expect(isValid).toBe(false);
    });
  });
});
