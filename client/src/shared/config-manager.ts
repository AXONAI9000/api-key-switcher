import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawn } from 'child_process';
import {
  AppConfig,
  ApiKey,
  ProviderConfig,
  ProviderType,
  DEFAULT_PROVIDERS,
} from './types';

// 配置文件路径
const CONFIG_DIR = path.join(os.homedir(), '.api-key-switcher');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// 创建默认配置
function createDefaultConfig(): AppConfig {
  const providers: Record<ProviderType, ProviderConfig> = {} as Record<
    ProviderType,
    ProviderConfig
  >;

  for (const [id, info] of Object.entries(DEFAULT_PROVIDERS)) {
    providers[id as ProviderType] = {
      envVar: info.envVar,
      currentKey: null,
      keys: [],
    };
  }

  return {
    version: '1.0',
    providers,
  };
}

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

// 确保配置目录存在
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// 异步确保配置目录存在
async function ensureConfigDirAsync(): Promise<void> {
  try {
    await fsPromises.access(CONFIG_DIR);
  } catch {
    await fsPromises.mkdir(CONFIG_DIR, { recursive: true });
  }
}

// 读取配置
export function loadConfig(): AppConfig {
  ensureConfigDir();

  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = createDefaultConfig();
    saveConfig(defaultConfig);
    return defaultConfig;
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
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

// 异步读取配置
export async function loadConfigAsync(): Promise<AppConfig> {
  await ensureConfigDirAsync();

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
    // 文件不存在，创建默认配置
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const defaultConfig = createDefaultConfig();
      await saveConfigAsync(defaultConfig);
      return defaultConfig;
    }
    console.error('Failed to load config:', error);
    return createDefaultConfig();
  }
}

// 保存配置
export function saveConfig(config: AppConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// 异步保存配置（带备份）
export async function saveConfigAsync(config: AppConfig): Promise<void> {
  await ensureConfigDirAsync();

  // 创建备份
  try {
    await fsPromises.access(CONFIG_FILE);
    const backupFile = `${CONFIG_FILE}.backup`;
    try {
      await fsPromises.copyFile(CONFIG_FILE, backupFile);
    } catch (backupError) {
      console.warn('Failed to create backup:', backupError);
    }
  } catch {
    // 文件不存在，无需备份
  }

  await fsPromises.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}


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

// 异步添加 Key
export async function addKeyAsync(
  provider: ProviderType,
  key: string,
  alias?: string,
  extraEnvVars?: Record<string, string>
): Promise<ApiKey> {
  const config = await loadConfigAsync();
  validateProvider(config, provider);

  const finalAlias = generateDefaultAlias(config, provider, alias);
  validateAliasNotExists(config, provider, finalAlias);

  const newKey = createApiKey(finalAlias, key, extraEnvVars);
  config.providers[provider].keys.push(newKey);

  if (config.providers[provider].keys.length === 1) {
    config.providers[provider].currentKey = finalAlias;
  }

  await saveConfigAsync(config);
  return newKey;
}

// 删除 Key
export function removeKey(provider: ProviderType, alias: string): boolean {
  const config = loadConfig();

  if (!config.providers[provider]) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const index = config.providers[provider].keys.findIndex(
    (k) => k.alias === alias
  );
  if (index === -1) {
    throw new Error(`Key with alias "${alias}" not found`);
  }

  config.providers[provider].keys.splice(index, 1);

  if (config.providers[provider].currentKey === alias) {
    const firstEnabled = config.providers[provider].keys.find((k) => k.enabled);
    config.providers[provider].currentKey = firstEnabled?.alias || null;
  }

  saveConfig(config);
  return true;
}

// 更新 Key
export function updateKey(
  provider: ProviderType,
  alias: string,
  updates: Partial<Pick<ApiKey, 'alias' | 'key' | 'enabled' | 'extraEnvVars'>>
): ApiKey {
  const config = loadConfig();

  if (!config.providers[provider]) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const keyIndex = config.providers[provider].keys.findIndex(
    (k) => k.alias === alias
  );
  if (keyIndex === -1) {
    throw new Error(`Key with alias "${alias}" not found`);
  }

  if (updates.alias && updates.alias !== alias) {
    const existingKey = config.providers[provider].keys.find(
      (k) => k.alias === updates.alias
    );
    if (existingKey) {
      throw new Error(`Key with alias "${updates.alias}" already exists`);
    }

    if (config.providers[provider].currentKey === alias) {
      config.providers[provider].currentKey = updates.alias;
    }
  }

  const updatedKey: ApiKey = {
    ...config.providers[provider].keys[keyIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  config.providers[provider].keys[keyIndex] = updatedKey;
  saveConfig(config);

  return updatedKey;
}

// 切换启用/禁用状态
export function toggleKey(
  provider: ProviderType,
  alias: string
): { enabled: boolean } {
  const config = loadConfig();

  if (!config.providers[provider]) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const key = config.providers[provider].keys.find((k) => k.alias === alias);
  if (!key) {
    throw new Error(`Key with alias "${alias}" not found`);
  }

  key.enabled = !key.enabled;
  key.updatedAt = new Date().toISOString();

  if (!key.enabled && config.providers[provider].currentKey === alias) {
    const firstEnabled = config.providers[provider].keys.find(
      (k) => k.enabled && k.alias !== alias
    );
    config.providers[provider].currentKey = firstEnabled?.alias || null;
  }

  saveConfig(config);
  return { enabled: key.enabled };
}

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

// 获取当前 Key
export function getCurrentKey(
  provider: ProviderType
): { alias: string; key: string } | null {
  const config = loadConfig();

  if (!config.providers[provider]) {
    return null;
  }

  const currentAlias = config.providers[provider].currentKey;
  if (!currentAlias) {
    return null;
  }

  const key = config.providers[provider].keys.find(
    (k) => k.alias === currentAlias
  );
  if (!key) {
    return null;
  }

  return { alias: key.alias, key: key.key };
}

// 获取服务商的所有 Key
export function getKeys(provider: ProviderType): ApiKey[] {
  const config = loadConfig();
  return config.providers[provider]?.keys || [];
}

// 导出配置到文件
export function exportConfig(filePath: string): void {
  const config = loadConfig();
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
}

// 从文件导入配置
export function importConfig(filePath: string): AppConfig {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const importedConfig = JSON.parse(content) as AppConfig;

  if (!importedConfig.version || !importedConfig.providers) {
    throw new Error('Invalid config format');
  }

  const currentConfig = loadConfig();

  for (const [provider, providerConfig] of Object.entries(
    importedConfig.providers
  )) {
    if (currentConfig.providers[provider as ProviderType]) {
      for (const key of providerConfig.keys) {
        const existing = currentConfig.providers[
          provider as ProviderType
        ].keys.find((k) => k.alias === key.alias || k.key === key.key);

        if (!existing) {
          currentConfig.providers[provider as ProviderType].keys.push(key);
        }
      }
    } else {
      currentConfig.providers[provider as ProviderType] = providerConfig;
    }
  }

  saveConfig(currentConfig);
  return currentConfig;
}

// 获取配置文件路径
export function getConfigPath(): string {
  return CONFIG_FILE;
}

// 遮蔽 Key 显示
export function maskKey(key: string): string {
  if (key.length <= 8) {
    return '****';
  }
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}


// 设置 Windows 用户级环境变量（单个）
export function setUserEnvVar(name: string, value: string): void {
  setUserEnvVarsBatch({ [name]: value });
}

// 广播环境变量变更（通知其他应用）
function broadcastEnvChange(): void {
  if (process.platform === 'win32') {
    // 使用 setx 设置一个临时变量来触发广播，异步执行不阻塞
    const child = spawn('setx', ['__DUMMY__', '1'], {
      stdio: 'ignore',
      detached: true,
      windowsHide: true,
    });
    child.unref();
  }
}

// 批量设置 Windows 用户级环境变量（使用 reg 命令，比 PowerShell 快很多）
export function setUserEnvVarsBatch(vars: Record<string, string>): void {
  const entries = Object.entries(vars);
  if (entries.length === 0) return;

  if (process.platform === 'win32') {
    // 使用 reg add 命令直接写注册表，比 PowerShell 快很多
    for (const [name, value] of entries) {
      const command = `reg add "HKCU\\Environment" /v "${name}" /t REG_SZ /d "${value}" /f`;
      execSync(command, { stdio: 'pipe', windowsHide: true });
    }
    // 广播环境变量变更消息
    broadcastEnvChange();
  } else {
    // Unix 系统：写入 shell 配置文件
    const shellConfig = path.join(os.homedir(), '.bashrc');

    let content = '';
    if (fs.existsSync(shellConfig)) {
      content = fs.readFileSync(shellConfig, 'utf-8');
    }

    for (const [name, value] of entries) {
      const exportLine = `export ${name}="${value}"`;
      const regex = new RegExp(`^export ${name}=.*$`, 'm');
      if (regex.test(content)) {
        content = content.replace(regex, exportLine);
      } else {
        content += `\n${exportLine}\n`;
      }
    }

    fs.writeFileSync(shellConfig, content, 'utf-8');
  }

  // 同时设置当前进程的环境变量
  for (const [name, value] of entries) {
    process.env[name] = value;
  }
}

// 读取实际的系统用户级环境变量（使用 reg query，比 PowerShell 快）
export function getUserEnvVar(name: string): string | null {
  if (process.platform === 'win32') {
    try {
      const command = `reg query "HKCU\\Environment" /v "${name}"`;
      const result = execSync(command, { stdio: 'pipe', encoding: 'utf-8', windowsHide: true });
      // 解析 reg query 输出格式: "    NAME    REG_SZ    VALUE"
      const match = result.match(/REG_(?:SZ|EXPAND_SZ)\s+(.+)/);
      if (match) {
        return match[1].trim() || null;
      }
      return null;
    } catch {
      return null;
    }
  } else {
    return process.env[name] || null;
  }
}

// 批量读取系统环境变量
export function getUserEnvVarsBatch(names: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};

  if (names.length === 0) return result;

  for (const name of names) {
    result[name] = getUserEnvVar(name);
  }

  return result;
}

// 删除用户级环境变量
export function removeUserEnvVar(name: string): void {
  if (process.platform === 'win32') {
    try {
      const command = `reg delete "HKCU\\Environment" /v "${name}" /f`;
      execSync(command, { stdio: 'pipe', windowsHide: true });
    } catch {
      // 忽略删除不存在的变量的错误
    }
  }
  delete process.env[name];
}


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

  // 更新配置
  config.providers[provider].currentKey = alias;
  saveConfig(config);

  // 收集所有需要设置的环境变量
  const appliedVars: Record<string, string> = {
    [config.providers[provider].envVar]: key.key,
    ...key.extraEnvVars,
  };

  // 批量设置所有环境变量
  setUserEnvVarsBatch(appliedVars);

  return { success: true, appliedVars };
}

// 异步切换 Key 并应用环境变量
export async function switchKeyAndApplyAsync(provider: ProviderType, alias: string): Promise<{
  success: boolean;
  appliedVars: Record<string, string>;
}> {
  const config = await loadConfigAsync();
  validateProvider(config, provider);

  const key = findKeyOrThrow(config, provider, alias);

  if (!key.enabled) {
    throw new Error(`Key "${alias}" is disabled`);
  }

  config.providers[provider].currentKey = alias;
  await saveConfigAsync(config);

  // 收集所有需要设置的环境变量
  const appliedVars: Record<string, string> = {
    [config.providers[provider].envVar]: key.key,
    ...key.extraEnvVars,
  };

  setUserEnvVarsBatch(appliedVars);

  return { success: true, appliedVars };
}

// 保留别名以保持向后兼容
export const addKeyWithExtras = addKey;

// 获取完整的 Key 信息（包含额外环境变量）
export function getFullKeyInfo(provider: ProviderType, alias: string): ApiKey | null {
  const config = loadConfig();

  if (!config.providers[provider]) {
    return null;
  }

  return config.providers[provider].keys.find((k) => k.alias === alias) || null;
}

// 重新排序 Keys
export function reorderKeys(provider: ProviderType, aliases: string[]): ApiKey[] {
  const config = loadConfig();

  if (!config.providers[provider]) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const currentKeys = config.providers[provider].keys;
  
  for (const alias of aliases) {
    if (!currentKeys.find(k => k.alias === alias)) {
      throw new Error(`Key with alias "${alias}" not found`);
    }
  }

  const reorderedKeys: ApiKey[] = [];
  for (const alias of aliases) {
    const key = currentKeys.find(k => k.alias === alias);
    if (key) {
      reorderedKeys.push(key);
    }
  }

  config.providers[provider].keys = reorderedKeys;
  saveConfig(config);

  return reorderedKeys;
}
