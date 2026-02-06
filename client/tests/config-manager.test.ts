import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config-cache
let mockConfig: any = null;

function createDefaultConfig() {
  return {
    version: '1.0',
    providers: {
      claude: { envVar: 'ANTHROPIC_AUTH_TOKEN', currentKey: null, keys: [] },
      openai: { envVar: 'OPENAI_API_KEY', currentKey: null, keys: [] },
      gemini: { envVar: 'GOOGLE_API_KEY', currentKey: null, keys: [] },
      deepseek: { envVar: 'DEEPSEEK_API_KEY', currentKey: null, keys: [] },
      custom: { envVar: 'CUSTOM_API_KEY', currentKey: null, keys: [] },
    },
  };
}

vi.mock('../src/shared/config-cache', () => ({
  getConfigCache: () => ({
    get: () => {
      if (!mockConfig) mockConfig = createDefaultConfig();
      return JSON.parse(JSON.stringify(mockConfig));
    },
    set: (config: any) => { mockConfig = JSON.parse(JSON.stringify(config)); },
  }),
  resetConfigCache: () => { mockConfig = null; },
}));

vi.mock('../src/shared/usage-tracker', () => ({
  recordSwitch: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  copyFileSync: vi.fn(),
  statSync: vi.fn(() => ({ mtimeMs: Date.now() })),
}));

vi.mock('fs/promises', () => ({
  access: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  copyFile: vi.fn(),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(() => ({ unref: vi.fn() })),
}));

import {
  loadConfig,
  addKey,
  removeKey,
  updateKey,
  toggleKey,
  switchKey,
  getCurrentKey,
  getKeys,
  maskKey,
  reorderKeys,
} from '../src/shared/config-manager';

describe('config-manager', () => {
  beforeEach(() => {
    mockConfig = null;
    vi.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('应该返回默认配置', () => {
      const config = loadConfig();
      expect(config.version).toBe('1.0');
      expect(config.providers.claude.envVar).toBe('ANTHROPIC_AUTH_TOKEN');
      expect(config.providers.claude.keys).toEqual([]);
    });
  });

  describe('addKey', () => {
    it('应该添加新 Key', () => {
      const key = addKey('claude', 'sk-test-key-123', 'my-key');
      expect(key.alias).toBe('my-key');
      expect(key.key).toBe('sk-test-key-123');
      expect(key.enabled).toBe(true);
    });

    it('第一个 Key 应该自动设为 currentKey', () => {
      addKey('claude', 'sk-test-key-123', 'first-key');
      const config = loadConfig();
      expect(config.providers.claude.currentKey).toBe('first-key');
    });

    it('重复 alias 应该抛错', () => {
      addKey('claude', 'sk-test-key-1', 'dup-key');
      expect(() => addKey('claude', 'sk-test-key-2', 'dup-key')).toThrow('already exists');
    });

    it('不提供 alias 时应该自动生成', () => {
      const key = addKey('claude', 'sk-test-key-123');
      expect(key.alias).toBe('key-1');
    });

    it('应该支持 extraEnvVars', () => {
      const key = addKey('claude', 'sk-test-key-123', 'extra-key', { ANTHROPIC_BASE_URL: 'https://proxy.example.com' });
      expect(key.extraEnvVars).toEqual({ ANTHROPIC_BASE_URL: 'https://proxy.example.com' });
    });

    it('第二个 Key 不应该改变 currentKey', () => {
      addKey('claude', 'sk-test-key-1', 'first');
      addKey('claude', 'sk-test-key-2', 'second');
      const config = loadConfig();
      expect(config.providers.claude.currentKey).toBe('first');
    });
  });

  describe('removeKey', () => {
    it('应该删除存在的 Key', () => {
      addKey('claude', 'sk-test-key-1', 'to-remove');
      const result = removeKey('claude', 'to-remove');
      expect(result).toBe(true);
      expect(getKeys('claude')).toHaveLength(0);
    });

    it('删除 currentKey 后应该自动切换', () => {
      addKey('claude', 'sk-test-key-1', 'first');
      addKey('claude', 'sk-test-key-2', 'second');
      removeKey('claude', 'first');
      const config = loadConfig();
      expect(config.providers.claude.currentKey).toBe('second');
    });

    it('删除不存在的 Key 应该抛错', () => {
      expect(() => removeKey('claude', 'nonexistent')).toThrow('not found');
    });
  });

  describe('updateKey', () => {
    it('应该更新 Key 属性', () => {
      addKey('claude', 'sk-old-key', 'update-me');
      const updated = updateKey('claude', 'update-me', { key: 'sk-new-key' });
      expect(updated.key).toBe('sk-new-key');
      expect(updated.updatedAt).toBeDefined();
    });

    it('更新 alias 时如果新 alias 已存在应该抛错', () => {
      addKey('claude', 'sk-key-1', 'key-a');
      addKey('claude', 'sk-key-2', 'key-b');
      expect(() => updateKey('claude', 'key-a', { alias: 'key-b' })).toThrow('already exists');
    });

    it('更新 currentKey 的 alias 应该同步更新 currentKey', () => {
      addKey('claude', 'sk-key-1', 'old-alias');
      updateKey('claude', 'old-alias', { alias: 'new-alias' });
      const config = loadConfig();
      expect(config.providers.claude.currentKey).toBe('new-alias');
    });
  });

  describe('toggleKey', () => {
    it('应该切换启用/禁用状态', () => {
      addKey('claude', 'sk-key-1', 'toggle-me');
      const result = toggleKey('claude', 'toggle-me');
      expect(result.enabled).toBe(false);
    });

    it('禁用 currentKey 后应该自动切换到其他启用的 Key', () => {
      addKey('claude', 'sk-key-1', 'first');
      addKey('claude', 'sk-key-2', 'second');
      toggleKey('claude', 'first');
      const config = loadConfig();
      expect(config.providers.claude.currentKey).toBe('second');
    });
  });

  describe('switchKey', () => {
    it('应该切换当前 Key', () => {
      addKey('claude', 'sk-key-1', 'first');
      addKey('claude', 'sk-key-2', 'second');
      switchKey('claude', 'second');
      const config = loadConfig();
      expect(config.providers.claude.currentKey).toBe('second');
    });

    it('切换到禁用的 Key 应该抛错', () => {
      addKey('claude', 'sk-key-1', 'disabled-key');
      toggleKey('claude', 'disabled-key');
      expect(() => switchKey('claude', 'disabled-key')).toThrow('disabled');
    });
  });

  describe('getCurrentKey', () => {
    it('无 Key 时应该返回 null', () => {
      expect(getCurrentKey('claude')).toBeNull();
    });

    it('有 Key 时应该返回正确信息', () => {
      addKey('claude', 'sk-test-key-123', 'my-key');
      const current = getCurrentKey('claude');
      expect(current).toEqual({ alias: 'my-key', key: 'sk-test-key-123' });
    });
  });

  describe('maskKey', () => {
    it('长 Key 应该显示前4后4', () => {
      expect(maskKey('sk-ant-api03-abcdefghijklmnop')).toBe('sk-a****mnop');
    });

    it('短 Key 应该显示 ****', () => {
      expect(maskKey('short')).toBe('****');
    });
  });

  describe('reorderKeys', () => {
    it('应该重新排序', () => {
      addKey('claude', 'sk-key-1', 'alpha');
      addKey('claude', 'sk-key-2', 'beta');
      addKey('claude', 'sk-key-3', 'gamma');
      const reordered = reorderKeys('claude', ['gamma', 'alpha', 'beta']);
      expect(reordered.map(k => k.alias)).toEqual(['gamma', 'alpha', 'beta']);
    });

    it('不存在的 alias 应该抛错', () => {
      addKey('claude', 'sk-key-1', 'exists');
      expect(() => reorderKeys('claude', ['nonexistent'])).toThrow('not found');
    });
  });
});
