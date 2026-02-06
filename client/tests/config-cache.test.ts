import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => JSON.stringify({
    version: '1.0',
    providers: {
      claude: { envVar: 'ANTHROPIC_AUTH_TOKEN', currentKey: null, keys: [] },
      openai: { envVar: 'OPENAI_API_KEY', currentKey: null, keys: [] },
      gemini: { envVar: 'GOOGLE_API_KEY', currentKey: null, keys: [] },
      deepseek: { envVar: 'DEEPSEEK_API_KEY', currentKey: null, keys: [] },
      custom: { envVar: 'CUSTOM_API_KEY', currentKey: null, keys: [] },
    },
  })),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  copyFileSync: vi.fn(),
}));

vi.mock('../src/shared/logger', () => ({
  Logger: class { debug() {} info() {} warn() {} error() {} },
}));

import { ConfigCache } from '../src/shared/config-cache';
import * as fs from 'fs';

describe('ConfigCache', () => {
  let cache: ConfigCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new ConfigCache();
  });

  afterEach(() => {
    cache.dispose();
  });

  it('首次 get 应该从磁盘读取', () => {
    const config = cache.get();
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    expect(config.version).toBe('1.0');
  });

  it('第二次 get 应该从缓存读取，不再读磁盘', () => {
    cache.get();
    cache.get();
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);
  });

  it('set 后 get 应该返回新值', () => {
    const config = cache.get();
    config.version = '2.0';
    cache.set(config);
    const result = cache.get();
    expect(result.version).toBe('2.0');
  });

  it('set 应该标记为 dirty', () => {
    const config = cache.get();
    cache.set(config);
    expect(cache.isDirty()).toBe(true);
  });

  it('flush 应该写入磁盘并清除 dirty 标记', () => {
    const config = cache.get();
    cache.set(config);
    cache.flush();
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(cache.isDirty()).toBe(false);
  });

  it('invalidate 应该清除缓存', () => {
    cache.get();
    cache.invalidate();
    cache.get();
    expect(fs.readFileSync).toHaveBeenCalledTimes(2);
  });
});
