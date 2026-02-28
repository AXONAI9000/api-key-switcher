# 关键优化实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 API Key Switcher 项目的 5 个关键优化点：安全性、性能和代码质量问题

**Architecture:**
- Client 端：将同步文件操作改为异步，添加网络请求重试机制，重构重复代码
- Server 端：添加速率限制中间件保护认证接口

**Tech Stack:** TypeScript, Node.js (fs.promises), ASP.NET Core (AspNetCoreRateLimit)

---

## Task 1: 添加服务器端速率限制（安全性 P0）

**Files:**
- Modify: `server/src/ApiKeySyncServer.csproj`
- Modify: `server/src/Program.cs`
- Create: `server/src/appsettings.json`

### Step 1: 添加 AspNetCoreRateLimit 包引用

编辑 `server/src/ApiKeySyncServer.csproj`，在 `<ItemGroup>` 中添加：

```xml
<PackageReference Include="AspNetCoreRateLimit" Version="5.0.0" />
```

### Step 2: 创建 appsettings.json 配置速率限制规则

创建 `server/src/appsettings.json`：

```json
{
  "IpRateLimiting": {
    "EnableEndpointRateLimiting": true,
    "StackBlockedRequests": false,
    "RealIpHeader": "X-Real-IP",
    "ClientIdHeader": "X-ClientId",
    "HttpStatusCode": 429,
    "GeneralRules": [
      {
        "Endpoint": "POST:/api/v1/auth/login",
        "Period": "1m",
        "Limit": 5
      },
      {
        "Endpoint": "POST:/api/v1/auth/register",
        "Period": "1h",
        "Limit": 3
      },
      {
        "Endpoint": "POST:/api/v1/auth/refresh",
        "Period": "1m",
        "Limit": 10
      },
      {
        "Endpoint": "*",
        "Period": "1s",
        "Limit": 10
      }
    ]
  }
}
```

### Step 3: 修改 Program.cs 注册速率限制服务

编辑 `server/src/Program.cs`，在文件顶部添加 using：

```csharp
using AspNetCoreRateLimit;
```

在 `builder.Services.AddControllers();` 之后添加：

```csharp
// 配置速率限制
builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(builder.Configuration.GetSection("IpRateLimiting"));
builder.Services.AddSingleton<IIpPolicyStore, MemoryCacheIpPolicyStore>();
builder.Services.AddSingleton<IRateLimitCounterStore, MemoryCacheRateLimitCounterStore>();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();
builder.Services.AddSingleton<IProcessingStrategy, AsyncKeyLockProcessingStrategy>();
builder.Services.AddInMemoryRateLimiting();
```

在 `app.UseCors();` 之后添加：

```csharp
app.UseIpRateLimiting();
```

### Step 4: 运行测试验证

```bash
cd server/src && dotnet restore && dotnet build
```

Expected: Build succeeded

### Step 5: 提交

```bash
git add server/src/ApiKeySyncServer.csproj server/src/Program.cs server/src/appsettings.json
git commit -m "$(cat <<'EOF'
feat(server): add rate limiting for auth endpoints

- Add AspNetCoreRateLimit package
- Configure rate limits: login 5/min, register 3/hour
- Protect against brute force attacks

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 将同步文件操作改为异步（性能 P1）

**Files:**
- Modify: `client/src/shared/config-manager.ts`

### Step 1: 添加异步文件操作导入

在 `client/src/shared/config-manager.ts` 顶部，修改 fs 导入：

```typescript
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
```

### Step 2: 添加异步版本的 loadConfig

在 `loadConfig` 函数后添加异步版本：

```typescript
// 异步读取配置
export async function loadConfigAsync(): Promise<AppConfig> {
  ensureConfigDir();

  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = createDefaultConfig();
    await saveConfigAsync(defaultConfig);
    return defaultConfig;
  }

  try {
    const content = await fsPromises.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(content) as AppConfig;

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
    console.error('Failed to load config:', error);
    return createDefaultConfig();
  }
}
```

### Step 3: 添加异步版本的 saveConfig

在 `saveConfig` 函数后添加异步版本：

```typescript
// 异步保存配置（带备份）
export async function saveConfigAsync(config: AppConfig): Promise<void> {
  ensureConfigDir();

  // 创建备份
  if (fs.existsSync(CONFIG_FILE)) {
    const backupFile = `${CONFIG_FILE}.backup`;
    try {
      await fsPromises.copyFile(CONFIG_FILE, backupFile);
    } catch {
      // 备份失败不阻止保存
    }
  }

  await fsPromises.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}
```

### Step 4: 添加异步版本的 addKey

在现有 `addKey` 函数后添加：

```typescript
// 异步添加 Key
export async function addKeyAsync(
  provider: ProviderType,
  key: string,
  alias?: string,
  extraEnvVars?: Record<string, string>
): Promise<ApiKey> {
  const config = await loadConfigAsync();

  if (!config.providers[provider]) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const finalAlias =
    alias || `key-${config.providers[provider].keys.length + 1}`;

  const existingKey = config.providers[provider].keys.find(
    (k) => k.alias === finalAlias
  );
  if (existingKey) {
    throw new Error(`Key with alias "${finalAlias}" already exists`);
  }

  const newKey: ApiKey = {
    alias: finalAlias,
    key,
    enabled: true,
    createdAt: new Date().toISOString(),
    extraEnvVars,
  };

  config.providers[provider].keys.push(newKey);

  if (config.providers[provider].keys.length === 1) {
    config.providers[provider].currentKey = finalAlias;
  }

  await saveConfigAsync(config);
  return newKey;
}
```

### Step 5: 添加异步版本的 switchKeyAndApply

```typescript
// 异步切换 Key 并应用环境变量
export async function switchKeyAndApplyAsync(provider: ProviderType, alias: string): Promise<{
  success: boolean;
  appliedVars: Record<string, string>;
}> {
  const config = await loadConfigAsync();

  if (!config.providers[provider]) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const key = config.providers[provider].keys.find((k) => k.alias === alias);
  if (!key) {
    throw new Error(`Key with alias "${alias}" not found`);
  }

  if (!key.enabled) {
    throw new Error(`Key "${alias}" is disabled`);
  }

  config.providers[provider].currentKey = alias;
  await saveConfigAsync(config);

  const appliedVars: Record<string, string> = {};
  const envVarName = config.providers[provider].envVar;

  appliedVars[envVarName] = key.key;

  if (key.extraEnvVars) {
    for (const [varName, varValue] of Object.entries(key.extraEnvVars)) {
      appliedVars[varName] = varValue;
    }
  }

  setUserEnvVarsBatch(appliedVars);

  return { success: true, appliedVars };
}
```

### Step 6: 提交

```bash
git add client/src/shared/config-manager.ts
git commit -m "$(cat <<'EOF'
feat(client): add async file operations with backup

- Add loadConfigAsync, saveConfigAsync for non-blocking I/O
- Add addKeyAsync, switchKeyAndApplyAsync
- Create backup before saving config
- Keep sync versions for backward compatibility

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 添加网络请求重试机制（用户体验 P2）

**Files:**
- Modify: `client/src/shared/sync/backends/server.ts`

### Step 1: 添加重试配置常量

在 `client/src/shared/sync/backends/server.ts` 顶部，`REQUEST_TIMEOUT` 后添加：

```typescript
// 重试配置
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1秒
const MAX_RETRY_DELAY = 8000; // 8秒
```

### Step 2: 添加延迟工具函数

在常量定义后添加：

```typescript
/**
 * 延迟执行
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 计算指数退避延迟
 */
function getRetryDelay(attempt: number): number {
  const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
  return Math.min(delay, MAX_RETRY_DELAY);
}

/**
 * 判断是否应该重试
 */
function shouldRetry(status: number): boolean {
  // 5xx 服务器错误、408 超时、429 限流 可以重试
  return status >= 500 || status === 408 || status === 429;
}
```

### Step 3: 重构 request 方法添加重试逻辑

替换 `ServerSyncBackend` 类中的 `request` 方法：

```typescript
  /**
   * 发送 HTTP 请求（带重试）
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<HttpResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 如果是可重试的错误且还有重试次数
        if (!response.ok && shouldRetry(response.status) && attempt < MAX_RETRIES) {
          const retryDelay = getRetryDelay(attempt);
          console.log(`Request failed with ${response.status}, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await delay(retryDelay);
          continue;
        }

        let data: T | undefined;
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          try {
            data = await response.json() as T;
          } catch {
            // JSON 解析失败，忽略
          }
        }

        return {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          data,
        };
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof BackendAuthError) {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error('Unknown error');

        // 网络错误可以重试
        if (attempt < MAX_RETRIES) {
          const retryDelay = getRetryDelay(attempt);
          console.log(`Network error: ${lastError.message}, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await delay(retryDelay);
          continue;
        }
      }
    }

    // 所有重试都失败
    if (lastError?.name === 'AbortError') {
      throw new BackendConnectionError('Request timeout after retries', this.type);
    }
    throw new BackendConnectionError(
      lastError?.message || 'Request failed after retries',
      this.type
    );
  }
```

### Step 4: 提交

```bash
git add client/src/shared/sync/backends/server.ts
git commit -m "$(cat <<'EOF'
feat(sync): add exponential backoff retry for network requests

- Retry up to 3 times on 5xx, 408, 429 errors
- Use exponential backoff: 1s -> 2s -> 4s -> 8s
- Log retry attempts for debugging
- Improve reliability on unstable networks

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 重构重复代码 - 提取公共验证逻辑（可维护性 P2）

**Files:**
- Modify: `client/src/shared/config-manager.ts`

### Step 1: 添加公共验证函数

在 `client/src/shared/config-manager.ts` 中，`createDefaultConfig` 函数后添加：

```typescript
/**
 * 验证 provider 是否存在
 */
function validateProvider(config: AppConfig, provider: ProviderType): void {
  if (!config.providers[provider]) {
    throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * 验证 key 是否存在并返回
 */
function findKeyOrThrow(config: AppConfig, provider: ProviderType, alias: string): ApiKey {
  const key = config.providers[provider].keys.find((k) => k.alias === alias);
  if (!key) {
    throw new Error(`Key with alias "${alias}" not found`);
  }
  return key;
}

/**
 * 验证 alias 是否已存在
 */
function validateAliasNotExists(config: AppConfig, provider: ProviderType, alias: string): void {
  const existingKey = config.providers[provider].keys.find((k) => k.alias === alias);
  if (existingKey) {
    throw new Error(`Key with alias "${alias}" already exists`);
  }
}

/**
 * 生成默认 alias
 */
function generateDefaultAlias(config: AppConfig, provider: ProviderType, customAlias?: string): string {
  return customAlias || `key-${config.providers[provider].keys.length + 1}`;
}

/**
 * 创建新的 ApiKey 对象
 */
function createApiKey(alias: string, key: string, extraEnvVars?: Record<string, string>): ApiKey {
  return {
    alias,
    key,
    enabled: true,
    createdAt: new Date().toISOString(),
    extraEnvVars,
  };
}
```

### Step 2: 重构 addKey 函数使用公共逻辑

替换现有的 `addKey` 函数：

```typescript
// 添加 Key
export function addKey(
  provider: ProviderType,
  key: string,
  alias?: string
): ApiKey {
  const config = loadConfig();
  validateProvider(config, provider);

  const finalAlias = generateDefaultAlias(config, provider, alias);
  validateAliasNotExists(config, provider, finalAlias);

  const newKey = createApiKey(finalAlias, key);
  config.providers[provider].keys.push(newKey);

  if (config.providers[provider].keys.length === 1) {
    config.providers[provider].currentKey = finalAlias;
  }

  saveConfig(config);
  return newKey;
}
```

### Step 3: 删除 addKeyWithExtras 并更新 addKey

由于 `addKey` 和 `addKeyWithExtras` 功能重复，删除 `addKeyWithExtras` 函数（第 484-522 行），并更新 `addKey` 支持 `extraEnvVars`：

```typescript
// 添加 Key（支持额外环境变量）
export function addKey(
  provider: ProviderType,
  key: string,
  alias?: string,
  extraEnvVars?: Record<string, string>
): ApiKey {
  const config = loadConfig();
  validateProvider(config, provider);

  const finalAlias = generateDefaultAlias(config, provider, alias);
  validateAliasNotExists(config, provider, finalAlias);

  const newKey = createApiKey(finalAlias, key, extraEnvVars);
  config.providers[provider].keys.push(newKey);

  if (config.providers[provider].keys.length === 1) {
    config.providers[provider].currentKey = finalAlias;
  }

  saveConfig(config);
  return newKey;
}

// 保留别名以保持向后兼容
export const addKeyWithExtras = addKey;
```

### Step 4: 重构 switchKey 和 switchKeyAndApply

替换 `switchKey` 函数：

```typescript
// 切换当前使用的 Key
export function switchKey(provider: ProviderType, alias: string): boolean {
  const config = loadConfig();
  validateProvider(config, provider);

  const key = findKeyOrThrow(config, provider, alias);

  if (!key.enabled) {
    throw new Error(`Key "${alias}" is disabled`);
  }

  config.providers[provider].currentKey = alias;
  saveConfig(config);

  return true;
}
```

替换 `switchKeyAndApply` 函数：

```typescript
// 切换 Key 并自动应用环境变量
export function switchKeyAndApply(provider: ProviderType, alias: string): {
  success: boolean;
  appliedVars: Record<string, string>;
} {
  const config = loadConfig();
  validateProvider(config, provider);

  const key = findKeyOrThrow(config, provider, alias);

  if (!key.enabled) {
    throw new Error(`Key "${alias}" is disabled`);
  }

  config.providers[provider].currentKey = alias;
  saveConfig(config);

  // 收集所有需要设置的环境变量
  const appliedVars: Record<string, string> = {
    [config.providers[provider].envVar]: key.key,
    ...key.extraEnvVars,
  };

  setUserEnvVarsBatch(appliedVars);

  return { success: true, appliedVars };
}
```

### Step 5: 提交

```bash
git add client/src/shared/config-manager.ts
git commit -m "$(cat <<'EOF'
refactor(config): extract common validation logic, remove duplicate code

- Add validateProvider, findKeyOrThrow, validateAliasNotExists helpers
- Merge addKey and addKeyWithExtras into single function
- Simplify switchKey and switchKeyAndApply using helpers
- Keep addKeyWithExtras as alias for backward compatibility

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 添加配置文件备份机制（数据安全）

**Files:**
- Modify: `client/src/shared/config-manager.ts`

### Step 1: 添加备份常量和函数

在 `CONFIG_FILE` 常量后添加：

```typescript
const CONFIG_BACKUP_FILE = path.join(CONFIG_DIR, 'config.json.backup');
const MAX_BACKUP_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7天
```

添加备份函数：

```typescript
/**
 * 创建配置备份
 */
function createBackup(): void {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.copyFileSync(CONFIG_FILE, CONFIG_BACKUP_FILE);
    }
  } catch (error) {
    console.error('Failed to create config backup:', error);
  }
}

/**
 * 从备份恢复配置
 */
export function restoreFromBackup(): AppConfig | null {
  try {
    if (fs.existsSync(CONFIG_BACKUP_FILE)) {
      const stats = fs.statSync(CONFIG_BACKUP_FILE);
      const age = Date.now() - stats.mtimeMs;

      if (age < MAX_BACKUP_AGE_MS) {
        const content = fs.readFileSync(CONFIG_BACKUP_FILE, 'utf-8');
        return JSON.parse(content) as AppConfig;
      }
    }
  } catch (error) {
    console.error('Failed to restore from backup:', error);
  }
  return null;
}
```

### Step 2: 修改 saveConfig 添加备份

更新 `saveConfig` 函数：

```typescript
// 保存配置（带备份）
export function saveConfig(config: AppConfig): void {
  ensureConfigDir();
  createBackup();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}
```

### Step 3: 提交

```bash
git add client/src/shared/config-manager.ts
git commit -m "$(cat <<'EOF'
feat(config): add automatic backup before saving

- Create backup file before each save
- Add restoreFromBackup function for recovery
- Backup expires after 7 days
- Prevent data loss from corruption

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## 验证清单

完成所有任务后，执行以下验证：

### Client 验证

```bash
cd client
npm run build
npm test
```

### Server 验证

```bash
cd server/src
dotnet restore
dotnet build
dotnet run &
# 测试速率限制
for i in {1..10}; do curl -X POST http://localhost:5000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test"}'; done
```

Expected: 第 6 次请求返回 429 Too Many Requests

---

## 总结

| Task | 优化点 | 优先级 | 影响 |
|------|--------|--------|------|
| 1 | 服务器速率限制 | P0 | 防止暴力破解 |
| 2 | 异步文件操作 | P1 | 提升 UI 响应 |
| 3 | 网络请求重试 | P2 | 改善弱网体验 |
| 4 | 重构重复代码 | P2 | 提高可维护性 |
| 5 | 配置文件备份 | P2 | 防止数据丢失 |
