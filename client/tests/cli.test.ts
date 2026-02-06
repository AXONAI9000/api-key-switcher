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
  getCurrentKey,
  getKeys,
  toggleKey,
  maskKey,
  switchKeyAndApply,
  getConfigPath,
  exportConfig,
} from '../src/shared/config-manager';
import { DEFAULT_PROVIDERS } from '../src/shared/types';
import type { ProviderType } from '../src/shared/types';

describe('CLI 命令功能测试', () => {
  beforeEach(() => {
    mockConfig = null;
    vi.clearAllMocks();
  });

  describe('add 命令 - addKey', () => {
    it('应该成功添加 Key 并返回新 Key 对象', () => {
      const key = addKey('claude', 'sk-ant-test-123', 'my-claude-key');
      expect(key.alias).toBe('my-claude-key');
      expect(key.key).toBe('sk-ant-test-123');
      expect(key.enabled).toBe(true);
      expect(key.createdAt).toBeDefined();
    });

    it('添加带 URL 的 Key（extraEnvVars）', () => {
      const key = addKey('openai', 'sk-openai-test', 'proxy-key', {
        OPENAI_BASE_URL: 'https://proxy.example.com',
      });
      expect(key.extraEnvVars).toEqual({ OPENAI_BASE_URL: 'https://proxy.example.com' });
    });
  });

  describe('remove 命令 - removeKey', () => {
    it('应该成功删除 Key', () => {
      addKey('claude', 'sk-test-1', 'to-delete');
      removeKey('claude', 'to-delete');
      expect(getKeys('claude')).toHaveLength(0);
    });
  });

  describe('list 命令 - getKeys/loadConfig', () => {
    it('无 Key 时返回空数组', () => {
      expect(getKeys('claude')).toHaveLength(0);
    });

    it('有 Key 时返回正确列表', () => {
      addKey('claude', 'sk-key-1', 'key1');
      addKey('claude', 'sk-key-2', 'key2');
      const keys = getKeys('claude');
      expect(keys).toHaveLength(2);
      expect(keys[0].alias).toBe('key1');
      expect(keys[1].alias).toBe('key2');
    });

    it('loadConfig 应该包含所有 provider', () => {
      const config = loadConfig();
      const providers = Object.keys(config.providers);
      expect(providers).toContain('claude');
      expect(providers).toContain('openai');
      expect(providers).toContain('gemini');
      expect(providers).toContain('deepseek');
      expect(providers).toContain('custom');
    });
  });

  describe('switch 命令 - switchKeyAndApply', () => {
    it('应该切换 Key 并返回应用的环境变量', () => {
      addKey('claude', 'sk-ant-test-key', 'switch-target');
      const result = switchKeyAndApply('claude', 'switch-target');
      expect(result.success).toBe(true);
      expect(result.appliedVars).toHaveProperty('ANTHROPIC_AUTH_TOKEN', 'sk-ant-test-key');
    });

    it('切换到禁用的 Key 应该抛错', () => {
      addKey('claude', 'sk-key-1', 'disabled-key');
      toggleKey('claude', 'disabled-key');
      expect(() => switchKeyAndApply('claude', 'disabled-key')).toThrow('disabled');
    });
  });

  describe('current 命令 - getCurrentKey', () => {
    it('无 Key 时返回 null', () => {
      expect(getCurrentKey('claude')).toBeNull();
    });

    it('有 Key 时返回当前 Key 信息', () => {
      addKey('claude', 'sk-current-key', 'active-key');
      const current = getCurrentKey('claude');
      expect(current).toEqual({ alias: 'active-key', key: 'sk-current-key' });
    });
  });

  describe('config 命令 - getConfigPath', () => {
    it('应该返回配置文件路径', () => {
      const configPath = getConfigPath();
      expect(configPath).toContain('config.json');
    });
  });

  describe('maskKey 工具函数', () => {
    it('长 Key 应该遮蔽中间部分', () => {
      const masked = maskKey('sk-ant-api03-abcdefghijklmnop');
      expect(masked).toContain('****');
      expect(masked.length).toBeLessThan('sk-ant-api03-abcdefghijklmnop'.length);
    });

    it('短 Key 应该完全遮蔽', () => {
      expect(maskKey('short')).toBe('****');
    });
  });

  describe('DEFAULT_PROVIDERS 验证', () => {
    it('应该包含所有支持的服务商', () => {
      expect(DEFAULT_PROVIDERS).toHaveProperty('claude');
      expect(DEFAULT_PROVIDERS).toHaveProperty('openai');
      expect(DEFAULT_PROVIDERS).toHaveProperty('gemini');
      expect(DEFAULT_PROVIDERS).toHaveProperty('deepseek');
      expect(DEFAULT_PROVIDERS).toHaveProperty('custom');
    });

    it('每个服务商应该有 name 和 envVar', () => {
      for (const [, info] of Object.entries(DEFAULT_PROVIDERS)) {
        expect(info).toHaveProperty('name');
        expect(info).toHaveProperty('envVar');
      }
    });
  });
});
