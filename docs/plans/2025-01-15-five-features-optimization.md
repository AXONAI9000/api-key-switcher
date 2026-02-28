# API Key Switcher 五大功能优化实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 API Key Switcher 添加 5 大功能：API Key 有效性验证、统一日志与错误处理、配置内存缓存+延迟写入、测试覆盖率提升、Key 使用统计与过期提醒。

**Architecture:** 采用自底向上的方式实施——先建立基础设施（错误处理、日志、缓存），再构建功能模块（Key 验证、使用统计），最后补充测试。每个功能模块独立，通过 shared 层共享。

**Tech Stack:** TypeScript, Electron, React, TailwindCSS, Vitest, .NET 10, xUnit

---

## 功能一：统一日志与错误处理体系

### Task 1: 创建错误类型层级

**Files:**
- Create: `client/src/shared/errors.ts`
- Test: `client/tests/errors.test.ts`

**Step 1: 写失败测试**

```typescript
// client/tests/errors.test.ts
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
```

**Step 2: 运行测试确认失败**

Run: `cd client && npx vitest run tests/errors.test.ts`
Expected: FAIL - 模块不存在

**Step 3: 实现错误类型**

```typescript
// client/src/shared/errors.ts
/**
 * 统一错误类型层级
 */

export enum ErrorCode {
  // 通用
  UNKNOWN = 'UNKNOWN',

  // 配置相关
  CONFIG_LOAD_FAILED = 'CONFIG_LOAD_FAILED',
  CONFIG_SAVE_FAILED = 'CONFIG_SAVE_FAILED',
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_BACKUP_FAILED = 'CONFIG_BACKUP_FAILED',

  // Key 相关
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
  KEY_ALREADY_EXISTS = 'KEY_ALREADY_EXISTS',
  KEY_DISABLED = 'KEY_DISABLED',
  KEY_INVALID = 'KEY_INVALID',
  KEY_EXPIRED = 'KEY_EXPIRED',
  KEY_RATE_LIMITED = 'KEY_RATE_LIMITED',
  KEY_QUOTA_EXCEEDED = 'KEY_QUOTA_EXCEEDED',

  // 验证相关
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  PROVIDER_UNKNOWN = 'PROVIDER_UNKNOWN',

  // 同步相关
  SYNC_PUSH_FAILED = 'SYNC_PUSH_FAILED',
  SYNC_PULL_FAILED = 'SYNC_PULL_FAILED',
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  SYNC_AUTH_FAILED = 'SYNC_AUTH_FAILED',
  SYNC_NETWORK_ERROR = 'SYNC_NETWORK_ERROR',

  // 环境变量
  ENV_SET_FAILED = 'ENV_SET_FAILED',
  ENV_READ_FAILED = 'ENV_READ_FAILED',
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly cause?: Error;
  public readonly timestamp: string;

  constructor(message: string, code: ErrorCode, cause?: Error) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
    };
  }
}

export class ConfigError extends AppError {
  constructor(message: string, code: ErrorCode, cause?: Error) {
    super(message, code, cause);
    this.name = 'ConfigError';
  }
}

export class SyncError extends AppError {
  constructor(message: string, code: ErrorCode, cause?: Error) {
    super(message, code, cause);
    this.name = 'SyncError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code: ErrorCode, cause?: Error) {
    super(message, code, cause);
    this.name = 'ValidationError';
  }
}

export class KeyValidationError extends AppError {
  public readonly provider: string;

  constructor(message: string, code: ErrorCode, provider: string, cause?: Error) {
    super(message, code, cause);
    this.name = 'KeyValidationError';
    this.provider = provider;
  }
}
```

**Step 4: 运行测试确认通过**

Run: `cd client && npx vitest run tests/errors.test.ts`
Expected: PASS

**Step 5: 提交**

```bash
git add client/src/shared/errors.ts client/tests/errors.test.ts
git commit -m "feat: add unified error type hierarchy"
```

---

### Task 2: 创建日志系统

**Files:**
- Create: `client/src/shared/logger.ts`
- Test: `client/tests/logger.test.ts`

**Step 1: 写失败测试**

```typescript
// client/tests/logger.test.ts
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
```

**Step 2: 运行测试确认失败**

Run: `cd client && npx vitest run tests/logger.test.ts`
Expected: FAIL

**Step 3: 实现日志系统**

```typescript
// client/src/shared/logger.ts
/**
 * 统一日志系统
 * 支持日志级别、敏感信息脱敏、模块上下文
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

let globalLogLevel: LogLevel = LogLevel.INFO;

export function setGlobalLogLevel(level: LogLevel): void {
  globalLogLevel = level;
}

export function getGlobalLogLevel(): LogLevel {
  return globalLogLevel;
}

// 敏感信息匹配模式
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // API Keys (各种格式)
  { pattern: /sk-ant-[a-zA-Z0-9_-]{10,}/g, replacement: 'sk-ant-***' },
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: 'sk-***' },
  { pattern: /AIza[a-zA-Z0-9_-]{30,}/g, replacement: 'AIza***' },
  // Bearer tokens
  { pattern: /Bearer\s+[a-zA-Z0-9._-]+/g, replacement: 'Bearer ***' },
  // 密码字段 (JSON)
  { pattern: /"(password|secret|token|apiKey|api_key)":\s*"[^"]*"/gi, replacement: '"$1":"***"' },
];

export class Logger {
  constructor(private context: string) {}

  debug(message: string, meta?: unknown): void {
    if (globalLogLevel <= LogLevel.DEBUG) {
      console.debug(`[${this.context}] ${message}`, meta !== undefined ? meta : '');
    }
  }

  info(message: string, meta?: unknown): void {
    if (globalLogLevel <= LogLevel.INFO) {
      console.info(`[${this.context}] ${message}`, meta !== undefined ? meta : '');
    }
  }

  warn(message: string, meta?: unknown): void {
    if (globalLogLevel <= LogLevel.WARN) {
      console.warn(`[${this.context}] ${message}`, meta !== undefined ? meta : '');
    }
  }

  error(message: string, error?: Error | unknown): void {
    if (globalLogLevel <= LogLevel.ERROR) {
      const sanitizedMsg = Logger.sanitize(message);
      const errorInfo = error instanceof Error
        ? { name: error.name, message: Logger.sanitize(error.message), stack: error.stack?.split('\n').slice(0, 3).join('\n') }
        : error;
      console.error(`[${this.context}] ${sanitizedMsg}`, errorInfo || '');
    }
  }

  /**
   * 脱敏敏感信息
   */
  static sanitize(input: string): string {
    let result = input;
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }
}
```

**Step 4: 运行测试确认通过**

Run: `cd client && npx vitest run tests/logger.test.ts`
Expected: PASS

**Step 5: 提交**

```bash
git add client/src/shared/logger.ts client/tests/logger.test.ts
git commit -m "feat: add unified logging system with sanitization"
```

---

## 功能二：配置内存缓存 + 延迟写入

### Task 3: 实现 ConfigCache 模块

**Files:**
- Create: `client/src/shared/config-cache.ts`
- Test: `client/tests/config-cache.test.ts`

**Step 1: 写失败测试**

```typescript
// client/tests/config-cache.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs 模块
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
```

**Step 2: 运行测试确认失败**

Run: `cd client && npx vitest run tests/config-cache.test.ts`
Expected: FAIL

**Step 3: 实现 ConfigCache**

```typescript
// client/src/shared/config-cache.ts
/**
 * 配置内存缓存 + 延迟写入
 * 减少磁盘 I/O，提升性能
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { AppConfig } from './types';
import { DEFAULT_PROVIDERS, ProviderType } from './types';
import { Logger } from './logger';

const logger = new Logger('ConfigCache');

const CONFIG_DIR = path.join(os.homedir(), '.api-key-switcher');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CONFIG_BACKUP_FILE = path.join(CONFIG_DIR, 'config.json.backup');
const FLUSH_DELAY_MS = 1000; // 延迟写入时间

function createDefaultConfig(): AppConfig {
  const providers = {} as Record<ProviderType, any>;
  for (const [id, info] of Object.entries(DEFAULT_PROVIDERS)) {
    providers[id as ProviderType] = {
      envVar: info.envVar,
      currentKey: null,
      keys: [],
    };
  }
  return { version: '1.0', providers };
}

export class ConfigCache {
  private cache: AppConfig | null = null;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * 获取配置（优先从缓存）
   */
  get(): AppConfig {
    if (!this.cache) {
      this.cache = this.loadFromDisk();
    }
    // 返回深拷贝防止外部直接修改缓存
    return JSON.parse(JSON.stringify(this.cache));
  }

  /**
   * 更新配置（写入缓存，延迟写磁盘）
   */
  set(config: AppConfig): void {
    this.cache = JSON.parse(JSON.stringify(config));
    this.dirty = true;
    this.scheduleFlush();
  }

  /**
   * 立即写入磁盘
   */
  flush(): void {
    if (!this.dirty || !this.cache) return;
    this.cancelScheduledFlush();
    this.saveToDisk(this.cache);
    this.dirty = false;
  }

  /**
   * 是否有未写入的变更
   */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * 清除缓存，下次 get 重新从磁盘读取
   */
  invalidate(): void {
    this.flush(); // 先写入未保存的变更
    this.cache = null;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.flush();
    this.cancelScheduledFlush();
  }

  private scheduleFlush(): void {
    this.cancelScheduledFlush();
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, FLUSH_DELAY_MS);
  }

  private cancelScheduledFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private loadFromDisk(): AppConfig {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      if (!fs.existsSync(CONFIG_FILE)) {
        const defaultConfig = createDefaultConfig();
        this.saveToDisk(defaultConfig);
        return defaultConfig;
      }
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(content) as AppConfig;
      // 确保所有 provider 都存在
      for (const [id, info] of Object.entries(DEFAULT_PROVIDERS)) {
        if (!config.providers[id as ProviderType]) {
          config.providers[id as ProviderType] = {
            envVar: info.envVar,
            currentKey: null,
            keys: [],
          };
        }
      }
      return config;
    } catch (error) {
      logger.error('Failed to load config from disk', error);
      return createDefaultConfig();
    }
  }

  private saveToDisk(config: AppConfig): void {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      // 创建备份
      if (fs.existsSync(CONFIG_FILE)) {
        try {
          fs.copyFileSync(CONFIG_FILE, CONFIG_BACKUP_FILE);
        } catch (e) {
          logger.warn('Failed to create backup');
        }
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to save config to disk', error);
    }
  }
}

// 全局单例
let instance: ConfigCache | null = null;

export function getConfigCache(): ConfigCache {
  if (!instance) {
    instance = new ConfigCache();
  }
  return instance;
}

export function resetConfigCache(): void {
  instance?.dispose();
  instance = null;
}
```

**Step 4: 运行测试确认通过**

Run: `cd client && npx vitest run tests/config-cache.test.ts`
Expected: PASS

**Step 5: 提交**

```bash
git add client/src/shared/config-cache.ts client/tests/config-cache.test.ts
git commit -m "feat: add config memory cache with delayed write"
```

---

### Task 4: 将 config-manager 迁移到使用 ConfigCache

**Files:**
- Modify: `client/src/shared/config-manager.ts`

**Step 1: 在 config-manager.ts 中引入 ConfigCache**

在文件顶部添加导入，将 `loadConfig` 和 `saveConfig` 改为使用缓存：

```typescript
// 在 config-manager.ts 顶部添加
import { getConfigCache } from './config-cache';

// 修改 loadConfig 函数（约第141行）
export function loadConfig(): AppConfig {
  return getConfigCache().get();
}

// 修改 saveConfig 函数（约第203行）
export function saveConfig(config: AppConfig): void {
  getConfigCache().set(config);
}
```

注意：保留 `loadConfigAsync` 和 `saveConfigAsync` 不变，它们用于同步模块的独立场景。

**Step 2: 运行现有测试确认不破坏**

Run: `cd client && npx vitest run`
Expected: 所有现有测试 PASS

**Step 3: 提交**

```bash
git add client/src/shared/config-manager.ts
git commit -m "refactor: migrate config-manager to use ConfigCache"
```

---

## 功能三：API Key 有效性验证

### Task 5: 创建 Key 验证器核心模块

**Files:**
- Create: `client/src/shared/key-validator.ts`
- Test: `client/tests/key-validator.test.ts`

**Step 1: 写失败测试**

测试文件 `client/tests/key-validator.test.ts` 需要覆盖：
- `getValidationEndpoint` 返回各 provider 的正确端点（claude 用 anthropic API, openai 用 /v1/models, gemini 用 generativelanguage, deepseek 用 deepseek API）
- `validateApiKey` 对有效 Key 返回 valid=true
- `validateApiKey` 对 401 返回 valid=false
- `validateApiKey` 对 429 返回 status=rate_limited（Key 仍有效）
- `validateApiKey` 对网络错误返回 network_error
- `validateApiKey` 对 custom provider 返回 status=skipped

**Step 2: 运行测试确认失败**

Run: `cd client && npx vitest run tests/key-validator.test.ts`

**Step 3: 实现 Key 验证器**

文件 `client/src/shared/key-validator.ts`：
- 导出 `KeyStatus` 类型: 'valid' | 'invalid' | 'expired' | 'rate_limited' | 'quota_exceeded' | 'network_error' | 'skipped'
- 导出 `KeyValidationResult` 接口: { valid, status, error?, provider, checkedAt }
- 导出 `ValidationEndpoint` 接口: { url, method, headers, body?, parseResponse }
- 导出 `getValidationEndpoint(provider, baseUrl?)` 函数，返回各 provider 的验证端点配置
- 导出 `validateApiKey(provider, key, baseUrl?)` 异步函数，发送轻量级请求验证 Key
- Claude: POST /v1/messages，用 x-api-key header
- OpenAI: GET /v1/models，用 Bearer token
- Gemini: GET /v1/models?key=xxx
- DeepSeek: GET /v1/models，用 Bearer token
- Custom: 跳过验证，返回 skipped
- 超时 15 秒，使用 AbortController

**Step 4: 运行测试确认通过**

**Step 5: 提交**

```bash
git add client/src/shared/key-validator.ts client/tests/key-validator.test.ts
git commit -m "feat: add API key validation for all providers"
```

---

### Task 6: 添加 Key 验证 IPC 通道和 preload 桥接

**Files:**
- Modify: `client/src/shared/types.ts` - 在 IPC_CHANNELS 中添加 `VALIDATE_KEY: 'key:validate'`
- Modify: `client/src/main/index.ts` - 添加 VALIDATE_KEY 的 ipcMain.handle
- Modify: `client/src/main/preload.ts` - 添加 validateKey 桥接方法

**Step 1: 在 types.ts 的 IPC_CHANNELS 中添加**

在 `REORDER_KEYS: 'key:reorder'` 之后添加 `VALIDATE_KEY: 'key:validate'`

**Step 2: 在 main/index.ts 的 setupIpcHandlers 中添加**

在 REORDER_KEYS handler 之后添加 VALIDATE_KEY handler，调用 `validateApiKey(provider, key, baseUrl)`

**Step 3: 在 preload.ts 中添加**

在 reorderKeys 之后添加 `validateKey: (provider, key, baseUrl?) => ipcRenderer.invoke(IPC_CHANNELS.VALIDATE_KEY, provider, key, baseUrl)`

**Step 4: 运行构建确认无编译错误**

Run: `cd client && npx tsc --noEmit`

**Step 5: 提交**

```bash
git add client/src/shared/types.ts client/src/main/index.ts client/src/main/preload.ts
git commit -m "feat: add key validation IPC channel and preload bridge"
```

---

### Task 7: 在 KeyCard 组件中添加验证按钮

**Files:**
- Modify: `client/src/renderer/components/KeyCard.tsx` - 添加验证按钮 UI
- Modify: `client/src/renderer/components/ProviderPanel.tsx` - 传递验证 props
- Modify: `client/src/renderer/App.tsx` - 添加验证状态管理和 handler

**Step 1: KeyCard.tsx 修改**

- 在 KeyCardProps 中添加 `onValidate?: () => void` 和 `validationStatus?` 属性
- 在操作按钮区添加验证按钮（盾牌图标），根据状态显示不同颜色和图标
- validating 时显示 Spinner，valid 显示绿色盾牌，invalid 显示红色警告

**Step 2: ProviderPanel.tsx 修改**

- 在 ProviderPanelProps 中添加 `onValidateKey?` 和 `validationStatuses?`
- 传递给 KeyCard 组件

**Step 3: App.tsx 修改**

- 添加 `validationStatuses` state: `Record<string, string>`
- 添加 `handleValidateKey(alias)` 函数，调用 `window.electronAPI.validateKey`
- 将 props 传递给 ProviderPanel

**Step 4: 提交**

```bash
git add client/src/renderer/components/KeyCard.tsx client/src/renderer/components/ProviderPanel.tsx client/src/renderer/App.tsx
git commit -m "feat: add key validation button to UI"
```

---

## 功能四：Key 使用统计与过期提醒

### Task 8: 扩展类型定义，添加统计字段

**Files:**
- Modify: `client/src/shared/types.ts`

**Step 1: 在 ApiKey 接口中添加统计字段**

在 `extraEnvVars?` 之后添加：

```typescript
  // 使用统计
  switchCount?: number;
  lastUsedAt?: string;
  totalUsageMs?: number;
  // 过期设置
  expiresAt?: string;
```

**Step 2: 添加 KeyUsageStats 接口**

```typescript
export interface KeyUsageStats {
  alias: string;
  provider: ProviderType;
  switchCount: number;
  lastUsedAt: string | null;
  totalUsageMs: number;
  expiresAt: string | null;
  isExpired: boolean;
  isExpiringSoon: boolean; // 7天内过期
}
```

**Step 3: 提交**

```bash
git add client/src/shared/types.ts
git commit -m "feat: add usage stats and expiry fields to ApiKey type"
```

---

### Task 9: 创建使用统计追踪模块

**Files:**
- Create: `client/src/shared/usage-tracker.ts`
- Test: `client/tests/usage-tracker.test.ts`

**Step 1: 写失败测试**

测试文件 `client/tests/usage-tracker.test.ts` 需要覆盖：
- `recordSwitch(provider, alias)` 应该增加 switchCount
- `recordSwitch` 应该更新 lastUsedAt
- `getStats(provider)` 应该返回所有 key 的统计信息
- `getExpiringKeys()` 应该返回 7 天内过期的 keys
- `getExpiredKeys()` 应该返回已过期的 keys
- `setExpiry(provider, alias, date)` 应该设置过期时间
- `clearExpiry(provider, alias)` 应该清除过期时间

**Step 2: 运行测试确认失败**

**Step 3: 实现使用统计追踪**

文件 `client/src/shared/usage-tracker.ts`：
- 导入 `getConfigCache` 使用缓存读写配置
- `recordSwitch(provider, alias)`: 更新 switchCount++, lastUsedAt, 计算 totalUsageMs
- `getStats(provider)`: 返回 KeyUsageStats[] 数组
- `getAllStats()`: 返回所有 provider 的统计
- `getExpiringKeys(daysThreshold = 7)`: 返回即将过期的 keys
- `getExpiredKeys()`: 返回已过期的 keys
- `setExpiry(provider, alias, expiresAt)`: 设置过期时间
- `clearExpiry(provider, alias)`: 清除过期时间

**Step 4: 运行测试确认通过**

**Step 5: 提交**

```bash
git add client/src/shared/usage-tracker.ts client/tests/usage-tracker.test.ts
git commit -m "feat: add key usage tracking and expiry management"
```

---

### Task 10: 集成使用统计到 config-manager 的 switchKeyAndApply

**Files:**
- Modify: `client/src/shared/config-manager.ts`

**Step 1: 在 switchKeyAndApply 函数中调用 recordSwitch**

在 `switchKeyAndApply` 函数（约第589行）中，在 `saveConfig(config)` 之后添加：

```typescript
  // 记录切换统计
  const { recordSwitch } = require('./usage-tracker');
  recordSwitch(provider, alias);
```

**Step 2: 运行现有测试确认不破坏**

Run: `cd client && npx vitest run`

**Step 3: 提交**

```bash
git add client/src/shared/config-manager.ts
git commit -m "feat: integrate usage tracking into key switching"
```

---

### Task 11: 添加过期检查定时器和系统通知

**Files:**
- Modify: `client/src/main/index.ts`

**Step 1: 在 app.whenReady 回调中添加过期检查定时器**

在 `setupIpcHandlers()` 之后添加：

```typescript
  // 每小时检查一次 Key 过期
  setInterval(() => {
    const { getExpiringKeys, getExpiredKeys } = require('../shared/usage-tracker');
    const expiring = getExpiringKeys();
    const expired = getExpiredKeys();

    if (expired.length > 0) {
      const { Notification } = require('electron');
      if (Notification.isSupported()) {
        new Notification({
          title: 'API Key 已过期',
          body: `${expired.map(k => k.alias).join(', ')} 已过期，请及时更换`,
        }).show();
      }
    }

    if (expiring.length > 0) {
      const { Notification } = require('electron');
      if (Notification.isSupported()) {
        new Notification({
          title: 'API Key 即将过期',
          body: `${expiring.map(k => k.alias).join(', ')} 将在 7 天内过期`,
        }).show();
      }
    }
  }, 60 * 60 * 1000); // 每小时
```

**Step 2: 添加统计和过期相关的 IPC handlers**

在 types.ts 的 IPC_CHANNELS 中添加：
```typescript
  GET_KEY_STATS: 'key:get-stats',
  SET_KEY_EXPIRY: 'key:set-expiry',
  CLEAR_KEY_EXPIRY: 'key:clear-expiry',
```

在 main/index.ts 中添加对应的 handlers。
在 preload.ts 中添加对应的桥接方法。

**Step 3: 提交**

```bash
git add client/src/main/index.ts client/src/shared/types.ts client/src/main/preload.ts
git commit -m "feat: add expiry check timer and stats IPC handlers"
```

---

### Task 12: 在 KeyCard 中显示统计信息和过期状态

**Files:**
- Modify: `client/src/renderer/components/KeyCard.tsx`
- Modify: `client/src/renderer/App.tsx`

**Step 1: 在 KeyCard 中添加统计显示**

在 Key 的元信息区域（URL 和日期旁边）添加：
- 切换次数显示（如 "切换 12 次"）
- 最后使用时间（如 "最后使用: 2小时前"）
- 过期状态标签（已过期显示红色，即将过期显示黄色）

**Step 2: 在 App.tsx 中加载统计数据**

- 添加 `keyStats` state
- 在 loadConfig 后调用 `window.electronAPI.getKeyStats(selectedProvider)` 加载统计
- 将统计数据传递给 ProviderPanel -> KeyCard

**Step 3: 提交**

```bash
git add client/src/renderer/components/KeyCard.tsx client/src/renderer/App.tsx client/src/renderer/components/ProviderPanel.tsx
git commit -m "feat: display usage stats and expiry status in UI"
```

---

## 功能五：测试覆盖率提升

### Task 13: config-manager 核心逻辑测试

**Files:**
- Create: `client/tests/config-manager.test.ts`

**Step 1: 编写测试**

需要覆盖的场景：
- `loadConfig`: 文件不存在时创建默认配置
- `loadConfig`: 正常加载已有配置
- `loadConfig`: 配置损坏时返回默认配置
- `saveConfig`: 正常保存
- `addKey`: 添加新 Key
- `addKey`: 重复 alias 应该抛错
- `addKey`: 第一个 Key 自动设为 currentKey
- `removeKey`: 删除存在的 Key
- `removeKey`: 删除 currentKey 后自动切换
- `updateKey`: 更新 Key 属性
- `toggleKey`: 切换启用/禁用
- `switchKey`: 切换到已禁用的 Key 应该抛错
- `maskKey`: 正确遮蔽 Key
- `importConfig`: 合并导入（不覆盖已有）
- `reorderKeys`: 重新排序

Mock `fs` 模块避免实际文件操作。

**Step 2: 运行测试**

Run: `cd client && npx vitest run tests/config-manager.test.ts`

**Step 3: 提交**

```bash
git add client/tests/config-manager.test.ts
git commit -m "test: add comprehensive config-manager unit tests"
```

---

### Task 14: CLI 命令测试

**Files:**
- Create: `client/tests/cli.test.ts`

**Step 1: 编写测试**

Mock config-manager 模块，测试 CLI 命令的输出：
- `list` 命令：无 Key 时显示提示，有 Key 时正确列出
- `add` 命令：调用 addKey 并显示成功信息
- `switch` 命令：调用 switchKeyAndApply
- `current` 命令：显示当前 Key
- `env` 命令：输出正确的 export 语句

**Step 2: 运行测试**

**Step 3: 提交**

```bash
git add client/tests/cli.test.ts
git commit -m "test: add CLI command unit tests"
```

---

### Task 15: 服务器端单元测试

**Files:**
- Create: `server/tests/ApiKeySyncServer.Tests.csproj`
- Create: `server/tests/Services/AuthServiceTests.cs`
- Create: `server/tests/Services/SyncServiceTests.cs`

**Step 1: 创建测试项目**

```bash
cd server && dotnet new xunit -o tests
cd tests && dotnet add reference ../src/ApiKeySyncServer.csproj
dotnet add package Moq
dotnet add package Microsoft.EntityFrameworkCore.InMemory
```

**Step 2: 编写 AuthService 测试**

覆盖场景：
- 注册新用户成功
- 注册重复邮箱失败
- 登录成功返回 JWT
- 登录密码错误失败
- 刷新令牌成功
- 刷新已撤销令牌失败
- 登出撤销令牌
- 修改密码成功

**Step 3: 编写 SyncService 测试**

覆盖场景：
- 保存配置成功
- 获取配置成功
- 获取不存在的配置返回 null
- 获取状态正确

**Step 4: 运行测试**

Run: `cd server/tests && dotnet test`

**Step 5: 提交**

```bash
git add server/tests/
git commit -m "test: add server-side unit tests for Auth and Sync services"
```

---

### Task 16: 集成测试 - 同步流程端到端

**Files:**
- Create: `client/tests/sync-integration.test.ts`

**Step 1: 编写集成测试**

测试完整的同步流程（mock 网络层）：
- 设置主密码 -> 加密配置 -> 推送 -> 拉取 -> 解密 -> 验证一致性
- 冲突检测：本地和远程都有变更时触发冲突
- 冲突解决：local 策略覆盖远程
- 冲突解决：remote 策略覆盖本地
- 冲突解决：merge 策略合并两个版本

**Step 2: 运行测试**

Run: `cd client && npx vitest run tests/sync-integration.test.ts`

**Step 3: 提交**

```bash
git add client/tests/sync-integration.test.ts
git commit -m "test: add sync flow integration tests"
```

---

## 最终验证

### Task 17: 全量测试和构建验证

**Step 1: 运行客户端全部测试**

Run: `cd client && npx vitest run`
Expected: 所有测试 PASS

**Step 2: 运行服务器全部测试**

Run: `cd server/tests && dotnet test`
Expected: 所有测试 PASS

**Step 3: 构建客户端确认无编译错误**

Run: `cd client && npx tsc --noEmit`
Expected: 无错误

**Step 4: 构建服务器确认无编译错误**

Run: `cd server/src && dotnet build`
Expected: Build succeeded

**Step 5: 最终提交**

```bash
git add -A
git commit -m "feat: complete five major feature optimizations

- Unified error types and logging system with sanitization
- Config memory cache with delayed write for better performance
- API Key validation for Claude, OpenAI, Gemini, DeepSeek
- Key usage statistics and expiry reminders
- Comprehensive test coverage for client and server"
```

---

## 任务依赖关系

```
Task 1 (错误类型) ──┐
Task 2 (日志系统) ──┤
                    ├── Task 3 (ConfigCache) ── Task 4 (迁移 config-manager)
                    │
                    ├── Task 5 (Key 验证器) ── Task 6 (IPC) ── Task 7 (UI)
                    │
                    └── Task 8 (类型扩展) ── Task 9 (统计模块) ── Task 10 (集成) ── Task 11 (定时器) ── Task 12 (UI)

Task 4 ──┐
Task 7 ──┤
Task 12 ─┤── Task 13-16 (测试) ── Task 17 (最终验证)
         │
```

Task 1-2 可以并行。Task 3 依赖 Task 2（使用 Logger）。Task 5 依赖 Task 1-2。Task 8-12 依赖 Task 3-4。测试任务在功能完成后进行。
