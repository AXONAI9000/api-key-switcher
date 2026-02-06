import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config-cache
const mockConfig = {
  version: '1.0',
  providers: {
    claude: {
      envVar: 'ANTHROPIC_AUTH_TOKEN',
      currentKey: 'key1',
      keys: [
        { alias: 'key1', key: 'sk-test-1', enabled: true, createdAt: '2024-01-01T00:00:00Z', switchCount: 5, lastUsedAt: '2024-06-01T00:00:00Z', totalUsageMs: 100000 },
        { alias: 'key2', key: 'sk-test-2', enabled: true, createdAt: '2024-01-01T00:00:00Z', expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
        { alias: 'key3', key: 'sk-test-3', enabled: true, createdAt: '2024-01-01T00:00:00Z', expiresAt: '2020-01-01T00:00:00Z' },
      ],
    },
    openai: { envVar: 'OPENAI_API_KEY', currentKey: null, keys: [] },
    gemini: { envVar: 'GOOGLE_API_KEY', currentKey: null, keys: [] },
    deepseek: { envVar: 'DEEPSEEK_API_KEY', currentKey: null, keys: [] },
    custom: { envVar: 'CUSTOM_API_KEY', currentKey: null, keys: [] },
  },
};

vi.mock('../src/shared/config-cache', () => {
  const cache = {
    get: vi.fn(() => JSON.parse(JSON.stringify(mockConfig))),
    set: vi.fn(),
    flush: vi.fn(),
  };
  return {
    getConfigCache: vi.fn(() => cache),
    ConfigCache: vi.fn(() => cache),
  };
});

import { recordSwitch, getStats, getExpiringKeys, getExpiredKeys, setExpiry, clearExpiry } from '../src/shared/usage-tracker';
import { getConfigCache } from '../src/shared/config-cache';

describe('使用统计追踪', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordSwitch', () => {
    it('应该增加 switchCount', () => {
      recordSwitch('claude', 'key1');
      const cache = getConfigCache();
      expect(cache.set).toHaveBeenCalled();
      const savedConfig = (cache.set as any).mock.calls[0][0];
      expect(savedConfig.providers.claude.keys[0].switchCount).toBe(6);
    });

    it('应该更新 lastUsedAt', () => {
      recordSwitch('claude', 'key1');
      const cache = getConfigCache();
      const savedConfig = (cache.set as any).mock.calls[0][0];
      expect(savedConfig.providers.claude.keys[0].lastUsedAt).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('应该返回所有 key 的统计信息', () => {
      const stats = getStats('claude');
      expect(stats).toHaveLength(3);
      expect(stats[0].alias).toBe('key1');
      expect(stats[0].switchCount).toBe(5);
    });
  });

  describe('getExpiringKeys', () => {
    it('应该返回 7 天内过期的 keys', () => {
      const expiring = getExpiringKeys();
      expect(expiring.length).toBeGreaterThanOrEqual(1);
      expect(expiring.some(k => k.alias === 'key2')).toBe(true);
    });
  });

  describe('getExpiredKeys', () => {
    it('应该返回已过期的 keys', () => {
      const expired = getExpiredKeys();
      expect(expired.length).toBeGreaterThanOrEqual(1);
      expect(expired.some(k => k.alias === 'key3')).toBe(true);
    });
  });

  describe('setExpiry', () => {
    it('应该设置过期时间', () => {
      const date = '2025-12-31T00:00:00Z';
      setExpiry('claude', 'key1', date);
      const cache = getConfigCache();
      expect(cache.set).toHaveBeenCalled();
      const savedConfig = (cache.set as any).mock.calls[0][0];
      expect(savedConfig.providers.claude.keys[0].expiresAt).toBe(date);
    });
  });

  describe('clearExpiry', () => {
    it('应该清除过期时间', () => {
      clearExpiry('claude', 'key3');
      const cache = getConfigCache();
      expect(cache.set).toHaveBeenCalled();
      const savedConfig = (cache.set as any).mock.calls[0][0];
      expect(savedConfig.providers.claude.keys[2].expiresAt).toBeUndefined();
    });
  });
});
