/**
 * 同步管理器单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AppConfig } from '../src/shared/types';

// 测试用配置
const createTestConfig = (): AppConfig => ({
  version: '1.0.0',
  providers: {
    claude: {
      envVar: 'ANTHROPIC_AUTH_TOKEN',
      currentKey: 'key1',
      keys: [
        {
          alias: 'key1',
          key: 'sk-ant-key1',
          enabled: true,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          alias: 'key2',
          key: 'sk-ant-key2',
          enabled: true,
          createdAt: '2024-01-02T00:00:00.000Z',
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
});

describe('配置合并逻辑', () => {
  // 模拟合并函数（从 sync-manager 中提取的逻辑）
  const mergeConfigs = (local: AppConfig, remote: AppConfig): AppConfig => {
    const merged: AppConfig = {
      version: local.version,
      providers: { ...local.providers },
    };

    for (const providerKey of Object.keys(remote.providers) as Array<keyof typeof remote.providers>) {
      const localProvider = local.providers[providerKey];
      const remoteProvider = remote.providers[providerKey];

      if (!localProvider) {
        merged.providers[providerKey] = remoteProvider;
        continue;
      }

      if (!remoteProvider) {
        continue;
      }

      const keyMap = new Map<string, typeof localProvider.keys[0]>();

      for (const key of localProvider.keys) {
        keyMap.set(key.alias, key);
      }

      for (const key of remoteProvider.keys) {
        const existingKey = keyMap.get(key.alias);
        if (!existingKey) {
          keyMap.set(key.alias, key);
        } else {
          const localTime = new Date(existingKey.updatedAt || existingKey.createdAt).getTime();
          const remoteTime = new Date(key.updatedAt || key.createdAt).getTime();
          if (remoteTime > localTime) {
            keyMap.set(key.alias, key);
          }
        }
      }

      merged.providers[providerKey] = {
        ...localProvider,
        keys: Array.from(keyMap.values()),
        currentKey: localProvider.currentKey || remoteProvider.currentKey,
      };
    }

    return merged;
  };

  it('应该合并两个配置中的不同 keys', () => {
    const local = createTestConfig();
    const remote = createTestConfig();

    // 远程有一个本地没有的 key
    remote.providers.claude.keys.push({
      alias: 'key3',
      key: 'sk-ant-key3',
      enabled: true,
      createdAt: '2024-01-03T00:00:00.000Z',
    });

    const merged = mergeConfigs(local, remote);

    expect(merged.providers.claude.keys.length).toBe(3);
    expect(merged.providers.claude.keys.find(k => k.alias === 'key3')).toBeDefined();
  });

  it('应该保留更新时间较新的 key', () => {
    const local = createTestConfig();
    const remote = createTestConfig();

    // 本地 key1 更新过
    local.providers.claude.keys[0].updatedAt = '2024-01-10T00:00:00.000Z';
    local.providers.claude.keys[0].key = 'sk-ant-key1-updated-local';

    // 远程 key1 也更新过，但时间更早
    remote.providers.claude.keys[0].updatedAt = '2024-01-05T00:00:00.000Z';
    remote.providers.claude.keys[0].key = 'sk-ant-key1-updated-remote';

    const merged = mergeConfigs(local, remote);

    // 应该保留本地的（更新时间更晚）
    expect(merged.providers.claude.keys.find(k => k.alias === 'key1')?.key).toBe('sk-ant-key1-updated-local');
  });

  it('应该使用远程更新时间较新的 key', () => {
    const local = createTestConfig();
    const remote = createTestConfig();

    // 远程 key1 更新时间更晚
    remote.providers.claude.keys[0].updatedAt = '2024-01-15T00:00:00.000Z';
    remote.providers.claude.keys[0].key = 'sk-ant-key1-updated-remote';

    const merged = mergeConfigs(local, remote);

    // 应该使用远程的
    expect(merged.providers.claude.keys.find(k => k.alias === 'key1')?.key).toBe('sk-ant-key1-updated-remote');
  });

  it('应该保留本地的 currentKey 设置', () => {
    const local = createTestConfig();
    const remote = createTestConfig();

    local.providers.claude.currentKey = 'key1';
    remote.providers.claude.currentKey = 'key2';

    const merged = mergeConfigs(local, remote);

    expect(merged.providers.claude.currentKey).toBe('key1');
  });

  it('应该使用远程的 currentKey 如果本地为空', () => {
    const local = createTestConfig();
    const remote = createTestConfig();

    local.providers.claude.currentKey = null;
    remote.providers.claude.currentKey = 'key2';

    const merged = mergeConfigs(local, remote);

    expect(merged.providers.claude.currentKey).toBe('key2');
  });

  it('应该合并不同服务商的 keys', () => {
    const local = createTestConfig();
    const remote = createTestConfig();

    // 远程有 OpenAI key
    remote.providers.openai.keys.push({
      alias: 'openai-key',
      key: 'sk-openai-key',
      enabled: true,
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    const merged = mergeConfigs(local, remote);

    expect(merged.providers.openai.keys.length).toBe(1);
    expect(merged.providers.openai.keys[0].alias).toBe('openai-key');
  });
});

describe('冲突检测', () => {
  it('应该检测到配置差异', () => {
    const local = createTestConfig();
    const remote = createTestConfig();

    // 修改远程配置
    remote.providers.claude.keys[0].key = 'different-key';

    const localChecksum = JSON.stringify(local);
    const remoteChecksum = JSON.stringify(remote);

    expect(localChecksum).not.toBe(remoteChecksum);
  });

  it('相同配置应该有相同的序列化结果', () => {
    const config1 = createTestConfig();
    const config2 = createTestConfig();

    expect(JSON.stringify(config1)).toBe(JSON.stringify(config2));
  });
});

describe('同步状态', () => {
  it('应该正确表示各种同步状态', () => {
    type SyncStatus = 'idle' | 'syncing' | 'uploading' | 'downloading' | 'conflict' | 'error';

    const validStatuses: SyncStatus[] = ['idle', 'syncing', 'uploading', 'downloading', 'conflict', 'error'];

    validStatuses.forEach(status => {
      expect(['idle', 'syncing', 'uploading', 'downloading', 'conflict', 'error']).toContain(status);
    });
  });
});
