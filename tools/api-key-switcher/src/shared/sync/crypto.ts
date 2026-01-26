/**
 * 同步模块加密功能
 * 使用 AES-256-GCM 加密，PBKDF2 密钥派生
 */

import * as crypto from 'crypto';
import type { EncryptedPackage, EncryptionKeyInfo } from './types';
import type { AppConfig } from '../types';

// 加密常量
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12;  // 96 bits for GCM
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;
const AUTH_TAG_LENGTH = 16;
const CURRENT_VERSION = 1;

/**
 * 使用 PBKDF2 从主密码派生加密密钥
 * @param password 主密码
 * @param salt 盐值（可选，如不提供则生成新的）
 * @returns 密钥信息（包含密钥和盐值）
 */
export async function deriveEncryptionKey(
  password: string,
  salt?: Buffer
): Promise<{ key: Buffer; salt: Buffer }> {
  const actualSalt = salt ?? crypto.randomBytes(SALT_LENGTH);

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      actualSalt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      'sha256',
      (err, key) => {
        if (err) {
          reject(err);
        } else {
          resolve({ key, salt: actualSalt });
        }
      }
    );
  });
}

/**
 * 使用 AES-256-GCM 加密配置
 * @param config 要加密的配置
 * @param password 主密码
 * @param deviceId 设备 ID
 * @returns 加密数据包
 */
export async function encryptConfig(
  config: AppConfig,
  password: string,
  deviceId: string
): Promise<EncryptedPackage> {
  // 序列化配置
  const plaintext = JSON.stringify(config);
  const plaintextBuffer = Buffer.from(plaintext, 'utf8');

  // 派生密钥
  const { key, salt } = await deriveEncryptionKey(password);

  // 生成随机 IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // 创建加密器
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // 加密数据
  const encrypted = Buffer.concat([
    cipher.update(plaintextBuffer),
    cipher.final(),
  ]);

  // 获取认证标签
  const authTag = cipher.getAuthTag();

  // 组合加密数据和认证标签
  const encryptedWithTag = Buffer.concat([encrypted, authTag]);

  // 计算校验和（对原始数据）
  const checksum = generateChecksum(plaintext);

  return {
    encryptedData: encryptedWithTag.toString('base64'),
    iv: iv.toString('base64'),
    salt: salt.toString('base64'),
    checksum,
    version: CURRENT_VERSION,
    timestamp: new Date().toISOString(),
    deviceId,
  };
}

/**
 * 使用 AES-256-GCM 解密配置
 * @param encryptedPackage 加密数据包
 * @param password 主密码
 * @returns 解密后的配置
 */
export async function decryptConfig(
  encryptedPackage: EncryptedPackage,
  password: string
): Promise<AppConfig> {
  // 解码 Base64 数据
  const encryptedWithTag = Buffer.from(encryptedPackage.encryptedData, 'base64');
  const iv = Buffer.from(encryptedPackage.iv, 'base64');
  const salt = Buffer.from(encryptedPackage.salt, 'base64');

  // 分离加密数据和认证标签
  const encrypted = encryptedWithTag.subarray(0, encryptedWithTag.length - AUTH_TAG_LENGTH);
  const authTag = encryptedWithTag.subarray(encryptedWithTag.length - AUTH_TAG_LENGTH);

  // 派生密钥（使用相同的盐值）
  const { key } = await deriveEncryptionKey(password, salt);

  // 创建解密器
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // 设置认证标签
  decipher.setAuthTag(authTag);

  // 解密数据
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  const plaintext = decrypted.toString('utf8');

  // 验证校验和
  const calculatedChecksum = generateChecksum(plaintext);
  if (calculatedChecksum !== encryptedPackage.checksum) {
    throw new Error('Checksum verification failed: data may be corrupted');
  }

  // 解析 JSON
  return JSON.parse(plaintext) as AppConfig;
}

/**
 * 生成 SHA-256 校验和
 * @param data 要计算校验和的数据
 * @returns 十六进制校验和
 */
export function generateChecksum(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * 验证加密数据包的完整性
 * @param encryptedPackage 加密数据包
 * @returns 是否有效
 */
export function validateEncryptedPackage(encryptedPackage: EncryptedPackage): boolean {
  try {
    // 检查必需字段
    if (!encryptedPackage.encryptedData ||
        !encryptedPackage.iv ||
        !encryptedPackage.salt ||
        !encryptedPackage.checksum ||
        !encryptedPackage.timestamp ||
        !encryptedPackage.deviceId) {
      return false;
    }

    // 检查版本
    if (typeof encryptedPackage.version !== 'number' || encryptedPackage.version < 1) {
      return false;
    }

    // 验证 Base64 格式
    Buffer.from(encryptedPackage.encryptedData, 'base64');
    Buffer.from(encryptedPackage.iv, 'base64');
    Buffer.from(encryptedPackage.salt, 'base64');

    // 验证时间戳格式
    new Date(encryptedPackage.timestamp);

    return true;
  } catch {
    return false;
  }
}

/**
 * 验证主密码强度
 * @param password 密码
 * @returns 强度评估结果
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  score: number; // 0-4
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  // 最小长度
  if (password.length < 8) {
    feedback.push('密码至少需要 8 个字符');
  } else {
    score += 1;
    if (password.length >= 12) {
      score += 1;
    }
  }

  // 包含数字
  if (!/\d/.test(password)) {
    feedback.push('建议包含数字');
  } else {
    score += 0.5;
  }

  // 包含小写字母
  if (!/[a-z]/.test(password)) {
    feedback.push('建议包含小写字母');
  } else {
    score += 0.5;
  }

  // 包含大写字母
  if (!/[A-Z]/.test(password)) {
    feedback.push('建议包含大写字母');
  } else {
    score += 0.5;
  }

  // 包含特殊字符
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    feedback.push('建议包含特殊字符');
  } else {
    score += 0.5;
  }

  return {
    valid: password.length >= 8,
    score: Math.min(4, Math.floor(score)),
    feedback,
  };
}

/**
 * 生成随机设备 ID
 * @returns 设备 ID
 */
export function generateDeviceId(): string {
  return `device_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * 哈希主密码用于存储验证
 * @param password 主密码
 * @param salt 盐值
 * @returns 哈希值
 */
export async function hashMasterPassword(
  password: string,
  salt?: Buffer
): Promise<{ hash: string; salt: string }> {
  const actualSalt = salt ?? crypto.randomBytes(SALT_LENGTH);

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      actualSalt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      'sha256',
      (err, derivedKey) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            hash: derivedKey.toString('hex'),
            salt: actualSalt.toString('hex'),
          });
        }
      }
    );
  });
}

/**
 * 验证主密码
 * @param password 输入的密码
 * @param storedHash 存储的哈希值
 * @param storedSalt 存储的盐值
 * @returns 是否匹配
 */
export async function verifyMasterPassword(
  password: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  const salt = Buffer.from(storedSalt, 'hex');
  const { hash } = await hashMasterPassword(password, salt);
  return hash === storedHash;
}
