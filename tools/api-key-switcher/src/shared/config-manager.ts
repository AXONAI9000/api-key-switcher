import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
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

// 确保配置目录存在
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
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

    // 确保所有默认服务商都存在
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

// 保存配置
export function saveConfig(config: AppConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// 添加 Key
export function addKey(
  provider: ProviderType,
  key: string,
  alias?: string
): ApiKey {
  const config = loadConfig();

  if (!config.providers[provider]) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  // 生成默认别名
  const finalAlias =
    alias || `key-${config.providers[provider].keys.length + 1}`;

  // 检查别名是否已存在
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
  };

  config.providers[provider].keys.push(newKey);

  // 如果是第一个 Key，自动设为当前
  if (config.providers[provider].keys.length === 1) {
    config.providers[provider].currentKey = finalAlias;
  }

  saveConfig(config);
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

  // 如果删除的是当前 Key，切换到第一个可用的
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
  updates: Partial<Pick<ApiKey, 'alias' | 'key' | 'enabled'>>
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

  // 如果更新别名，检查新别名是否已存在
  if (updates.alias && updates.alias !== alias) {
    const existingKey = config.providers[provider].keys.find(
      (k) => k.alias === updates.alias
    );
    if (existingKey) {
      throw new Error(`Key with alias "${updates.alias}" already exists`);
    }

    // 更新 currentKey 引用
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

  // 如果禁用当前 Key，切换到其他可用的
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

  // 验证配置格式
  if (!importedConfig.version || !importedConfig.providers) {
    throw new Error('Invalid config format');
  }

  // 合并到现有配置
  const currentConfig = loadConfig();

  for (const [provider, providerConfig] of Object.entries(
    importedConfig.providers
  )) {
    if (currentConfig.providers[provider as ProviderType]) {
      // 合并 keys，避免重复
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

// 批量设置 Windows 用户级环境变量（只启动一次 PowerShell）
export function setUserEnvVarsBatch(vars: Record<string, string>): void {
  const entries = Object.entries(vars);
  if (entries.length === 0) return;

  if (process.platform === 'win32') {
    // 构建批量设置命令，只启动一次 PowerShell
    const commands = entries.map(([name, value]) => {
      const escapedValue = value.replace(/"/g, '`"');
      return `[System.Environment]::SetEnvironmentVariable('${name}', '${escapedValue}', 'User')`;
    });
    const command = `powershell -Command "${commands.join('; ')}"`;
    execSync(command, { stdio: 'pipe' });
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

// 读取实际的系统用户级环境变量
export function getUserEnvVar(name: string): string | null {
  if (process.platform === 'win32') {
    try {
      const command = `powershell -Command "[System.Environment]::GetEnvironmentVariable('${name}', 'User')"`;
      const result = execSync(command, { stdio: 'pipe', encoding: 'utf-8' });
      const value = result.trim();
      return value || null;
    } catch {
      return null;
    }
  } else {
    // Unix: 从环境变量读取
    return process.env[name] || null;
  }
}

// 批量读取系统环境变量
export function getUserEnvVarsBatch(names: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};

  if (names.length === 0) return result;

  if (process.platform === 'win32') {
    try {
      // 构建批量读取命令
      const commands = names.map(name =>
        `Write-Output "${name}=$([System.Environment]::GetEnvironmentVariable('${name}', 'User'))"`
      );
      const command = `powershell -Command "${commands.join('; ')}"`;
      const output = execSync(command, { stdio: 'pipe', encoding: 'utf-8' });

      // 解析输出
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const eqIndex = line.indexOf('=');
        if (eqIndex > 0) {
          const name = line.substring(0, eqIndex).trim();
          const value = line.substring(eqIndex + 1).trim();
          result[name] = value || null;
        }
      }
    } catch {
      // 出错时返回空结果
      for (const name of names) {
        result[name] = null;
      }
    }
  } else {
    for (const name of names) {
      result[name] = process.env[name] || null;
    }
  }

  return result;
}

// 删除用户级环境变量
export function removeUserEnvVar(name: string): void {
  if (process.platform === 'win32') {
    const command = `powershell -Command "[System.Environment]::SetEnvironmentVariable('${name}', $null, 'User')"`;
    execSync(command, { stdio: 'pipe' });
  }
  delete process.env[name];
}

// 切换 Key 并自动应用环境变量
export function switchKeyAndApply(provider: ProviderType, alias: string): {
  success: boolean;
  appliedVars: Record<string, string>;
} {
  const config = loadConfig();

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

  // 更新配置
  config.providers[provider].currentKey = alias;
  saveConfig(config);

  // 收集所有需要设置的环境变量
  const appliedVars: Record<string, string> = {};
  const envVarName = config.providers[provider].envVar;

  // 主 API Key
  appliedVars[envVarName] = key.key;

  // 额外的环境变量
  if (key.extraEnvVars) {
    for (const [varName, varValue] of Object.entries(key.extraEnvVars)) {
      appliedVars[varName] = varValue;
    }
  }

  // 批量设置所有环境变量（只启动一次 PowerShell）
  setUserEnvVarsBatch(appliedVars);

  return { success: true, appliedVars };
}

// 添加带额外环境变量的 Key
export function addKeyWithExtras(
  provider: ProviderType,
  key: string,
  alias?: string,
  extraEnvVars?: Record<string, string>
): ApiKey {
  const config = loadConfig();

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

  saveConfig(config);
  return newKey;
}

// 获取完整的 Key 信息（包含额外环境变量）
export function getFullKeyInfo(provider: ProviderType, alias: string): ApiKey | null {
  const config = loadConfig();

  if (!config.providers[provider]) {
    return null;
  }

  return config.providers[provider].keys.find((k) => k.alias === alias) || null;
}
