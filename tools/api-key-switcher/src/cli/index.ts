#!/usr/bin/env node

import { Command } from 'commander';
import {
  loadConfig,
  addKey,
  removeKey,
  getCurrentKey,
  getKeys,
  toggleKey,
  exportConfig,
  importConfig,
  getConfigPath,
  maskKey,
  switchKeyAndApply,
  addKeyWithExtras,
  setUserEnvVar,
  getFullKeyInfo,
} from '../shared/config-manager';
import { ProviderType, DEFAULT_PROVIDERS } from '../shared/types';

const program = new Command();

program
  .name('api-key-switcher')
  .description('管理和切换多个 AI 服务商的 API Key（自动设置系统环境变量）')
  .version('1.0.0');

// 验证服务商
function validateProvider(provider: string): ProviderType {
  const validProviders = Object.keys(DEFAULT_PROVIDERS);
  if (!validProviders.includes(provider)) {
    console.error(
      `错误: 无效的服务商 "${provider}"。有效选项: ${validProviders.join(', ')}`
    );
    process.exit(1);
  }
  return provider as ProviderType;
}

// add 命令 - 添加 Key
program
  .command('add <provider> <key>')
  .description('添加新的 API Key')
  .option('-a, --alias <alias>', '为 Key 设置别名')
  .option('-u, --url <url>', 'API Base URL (用于代理服务)')
  .option('-e, --env <envVars...>', '额外的环境变量，格式: NAME=VALUE')
  .action((provider: string, key: string, options: { alias?: string; url?: string; env?: string[] }) => {
    try {
      const validProvider = validateProvider(provider);

      // 解析额外环境变量
      const extraEnvVars: Record<string, string> = {};

      // 如果指定了 URL，根据服务商设置对应的 BASE_URL 环境变量
      if (options.url) {
        const baseUrlEnvMap: Record<string, string> = {
          claude: 'ANTHROPIC_BASE_URL',
          openai: 'OPENAI_BASE_URL',
          gemini: 'GOOGLE_API_BASE_URL',
          deepseek: 'DEEPSEEK_BASE_URL',
          custom: 'CUSTOM_BASE_URL',
        };
        const baseUrlEnv = baseUrlEnvMap[validProvider];
        if (baseUrlEnv) {
          extraEnvVars[baseUrlEnv] = options.url;
        }
      }

      // 解析其他额外环境变量
      if (options.env && options.env.length > 0) {
        for (const envStr of options.env) {
          const [name, ...valueParts] = envStr.split('=');
          if (name && valueParts.length > 0) {
            extraEnvVars[name] = valueParts.join('=');
          }
        }
      }

      const newKey = addKeyWithExtras(
        validProvider,
        key,
        options.alias,
        Object.keys(extraEnvVars).length > 0 ? extraEnvVars : undefined
      );
      console.log(`✓ 成功添加 Key "${newKey.alias}" 到 ${provider}`);

      if (Object.keys(extraEnvVars).length > 0) {
        console.log('  额外环境变量:');
        for (const [varName, varValue] of Object.entries(extraEnvVars)) {
          console.log(`    ${varName}=${varValue}`);
        }
      }
    } catch (error) {
      console.error(`错误: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// remove 命令 - 删除 Key
program
  .command('remove <provider> <alias>')
  .description('删除指定的 API Key')
  .action((provider: string, alias: string) => {
    try {
      const validProvider = validateProvider(provider);
      removeKey(validProvider, alias);
      console.log(`✓ 成功删除 Key "${alias}"`);
    } catch (error) {
      console.error(`错误: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// list 命令 - 列出所有 Key
program
  .command('list [provider]')
  .description('列出所有 API Key')
  .option('-s, --show-keys', '显示完整的 Key 值')
  .action((provider?: string, options?: { showKeys?: boolean }) => {
    try {
      const config = loadConfig();
      const providers = provider
        ? [validateProvider(provider)]
        : (Object.keys(config.providers) as ProviderType[]);

      for (const p of providers) {
        const providerInfo = DEFAULT_PROVIDERS[p];
        const providerConfig = config.providers[p];

        console.log(`\n${providerInfo.name} (${providerInfo.envVar}):`);
        console.log('─'.repeat(50));

        if (providerConfig.keys.length === 0) {
          console.log('  (无 Key)');
          continue;
        }

        for (const key of providerConfig.keys) {
          const isCurrent = providerConfig.currentKey === key.alias;
          const status = key.enabled ? '✓' : '✗';
          const currentMark = isCurrent ? ' [当前]' : '';
          const keyDisplay = options?.showKeys ? key.key : maskKey(key.key);

          console.log(
            `  ${status} ${key.alias}${currentMark}: ${keyDisplay}`
          );

          // 显示额外环境变量
          if (key.extraEnvVars && Object.keys(key.extraEnvVars).length > 0) {
            for (const [varName, varValue] of Object.entries(key.extraEnvVars)) {
              const valueDisplay = options?.showKeys ? varValue : maskKey(varValue);
              console.log(`      ${varName}=${valueDisplay}`);
            }
          }
        }
      }
      console.log('');
    } catch (error) {
      console.error(`错误: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// switch 命令 - 切换 Key 并自动应用环境变量
program
  .command('switch <provider> <alias>')
  .description('切换到指定的 API Key 并自动设置系统环境变量')
  .option('--no-apply', '仅切换配置，不设置系统环境变量')
  .action((provider: string, alias: string, options: { apply: boolean }) => {
    try {
      const validProvider = validateProvider(provider);

      if (options.apply) {
        // 切换并应用环境变量
        const result = switchKeyAndApply(validProvider, alias);
        console.log(`✓ 已切换到 Key "${alias}" 并设置系统环境变量`);
        console.log('');
        console.log('已设置的环境变量:');
        for (const [varName, varValue] of Object.entries(result.appliedVars)) {
          console.log(`  ${varName}=${maskKey(varValue)}`);
        }
        console.log('');
        console.log('注意: 新开的终端窗口会自动使用新的环境变量');
      } else {
        // 仅切换配置
        const config = loadConfig();
        const key = config.providers[validProvider].keys.find(k => k.alias === alias);
        if (!key) throw new Error(`Key "${alias}" not found`);
        if (!key.enabled) throw new Error(`Key "${alias}" is disabled`);
        config.providers[validProvider].currentKey = alias;
        console.log(`✓ 已切换到 Key "${alias}"（未设置系统环境变量）`);
      }
    } catch (error) {
      console.error(`错误: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// apply 命令 - 应用当前 Key 的环境变量
program
  .command('apply [provider]')
  .description('将当前选中的 Key 应用到系统环境变量')
  .action((provider?: string) => {
    try {
      const config = loadConfig();
      const providers = provider
        ? [validateProvider(provider)]
        : (Object.keys(config.providers) as ProviderType[]);

      const appliedVars: Record<string, string> = {};

      for (const p of providers) {
        const providerConfig = config.providers[p];
        if (!providerConfig.currentKey) continue;

        const key = providerConfig.keys.find(k => k.alias === providerConfig.currentKey);
        if (!key || !key.enabled) continue;

        // 设置主 Key
        setUserEnvVar(providerConfig.envVar, key.key);
        appliedVars[providerConfig.envVar] = key.key;

        // 设置额外环境变量
        if (key.extraEnvVars) {
          for (const [varName, varValue] of Object.entries(key.extraEnvVars)) {
            setUserEnvVar(varName, varValue);
            appliedVars[varName] = varValue;
          }
        }
      }

      if (Object.keys(appliedVars).length === 0) {
        console.log('没有可应用的 Key');
        return;
      }

      console.log('✓ 已设置系统环境变量:');
      for (const [varName, varValue] of Object.entries(appliedVars)) {
        console.log(`  ${varName}=${maskKey(varValue)}`);
      }
      console.log('');
      console.log('注意: 新开的终端窗口会自动使用新的环境变量');
    } catch (error) {
      console.error(`错误: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// current 命令 - 显示当前 Key
program
  .command('current [provider]')
  .description('显示当前使用的 API Key')
  .option('-s, --show-key', '显示完整的 Key 值')
  .action((provider?: string, options?: { showKey?: boolean }) => {
    try {
      const config = loadConfig();
      const providers = provider
        ? [validateProvider(provider)]
        : (Object.keys(config.providers) as ProviderType[]);

      for (const p of providers) {
        const providerInfo = DEFAULT_PROVIDERS[p];
        const currentKey = getCurrentKey(p);

        if (currentKey) {
          const keyDisplay = options?.showKey
            ? currentKey.key
            : maskKey(currentKey.key);
          console.log(
            `${providerInfo.name}: ${currentKey.alias} (${keyDisplay})`
          );

          // 显示额外环境变量
          const fullKey = getFullKeyInfo(p, currentKey.alias);
          if (fullKey?.extraEnvVars) {
            for (const [varName, varValue] of Object.entries(fullKey.extraEnvVars)) {
              const valueDisplay = options?.showKey ? varValue : maskKey(varValue);
              console.log(`  ${varName}=${valueDisplay}`);
            }
          }
        } else {
          console.log(`${providerInfo.name}: (未设置)`);
        }
      }
    } catch (error) {
      console.error(`错误: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// enable 命令 - 启用 Key
program
  .command('enable <provider> <alias>')
  .description('启用指定的 API Key')
  .action((provider: string, alias: string) => {
    try {
      const validProvider = validateProvider(provider);
      const keys = getKeys(validProvider);
      const key = keys.find((k) => k.alias === alias);

      if (!key) {
        throw new Error(`Key with alias "${alias}" not found`);
      }

      if (key.enabled) {
        console.log(`Key "${alias}" 已经是启用状态`);
        return;
      }

      toggleKey(validProvider, alias);
      console.log(`✓ 已启用 Key "${alias}"`);
    } catch (error) {
      console.error(`错误: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// disable 命令 - 禁用 Key
program
  .command('disable <provider> <alias>')
  .description('禁用指定的 API Key')
  .action((provider: string, alias: string) => {
    try {
      const validProvider = validateProvider(provider);
      const keys = getKeys(validProvider);
      const key = keys.find((k) => k.alias === alias);

      if (!key) {
        throw new Error(`Key with alias "${alias}" not found`);
      }

      if (!key.enabled) {
        console.log(`Key "${alias}" 已经是禁用状态`);
        return;
      }

      toggleKey(validProvider, alias);
      console.log(`✓ 已禁用 Key "${alias}"`);
    } catch (error) {
      console.error(`错误: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// export 命令 - 导出配置
program
  .command('export <file>')
  .description('导出配置到文件')
  .action((file: string) => {
    try {
      exportConfig(file);
      console.log(`✓ 配置已导出到 ${file}`);
    } catch (error) {
      console.error(`错误: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// import 命令 - 导入配置
program
  .command('import <file>')
  .description('从文件导入配置')
  .action((file: string) => {
    try {
      importConfig(file);
      console.log(`✓ 配置已从 ${file} 导入`);
    } catch (error) {
      console.error(`错误: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// config 命令 - 显示配置路径
program
  .command('config')
  .description('显示配置文件路径')
  .action(() => {
    console.log(`配置文件路径: ${getConfigPath()}`);
  });

// env 命令 - 输出环境变量设置命令（供手动执行）
program
  .command('env [provider]')
  .description('输出设置环境变量的命令（供手动执行）')
  .option('-e, --export', '使用 export 格式 (Unix)')
  .option('-s, --set', '使用 set 格式 (Windows)')
  .option('-p, --powershell', '使用 PowerShell 格式')
  .action((provider?: string, options?: { export?: boolean; set?: boolean; powershell?: boolean }) => {
    try {
      const config = loadConfig();
      const providers = provider
        ? [validateProvider(provider)]
        : (Object.keys(config.providers) as ProviderType[]);

      const isWindows = process.platform === 'win32';

      for (const p of providers) {
        const providerConfig = config.providers[p];
        if (!providerConfig.currentKey) continue;

        const key = providerConfig.keys.find(k => k.alias === providerConfig.currentKey);
        if (!key) continue;

        const envVar = providerConfig.envVar;

        if (options?.powershell) {
          console.log(`[System.Environment]::SetEnvironmentVariable("${envVar}", "${key.key}", "User")`);
          if (key.extraEnvVars) {
            for (const [varName, varValue] of Object.entries(key.extraEnvVars)) {
              console.log(`[System.Environment]::SetEnvironmentVariable("${varName}", "${varValue}", "User")`);
            }
          }
        } else if (options?.export || (!options?.set && !isWindows)) {
          console.log(`export ${envVar}="${key.key}"`);
          if (key.extraEnvVars) {
            for (const [varName, varValue] of Object.entries(key.extraEnvVars)) {
              console.log(`export ${varName}="${varValue}"`);
            }
          }
        } else {
          console.log(`set ${envVar}=${key.key}`);
          if (key.extraEnvVars) {
            for (const [varName, varValue] of Object.entries(key.extraEnvVars)) {
              console.log(`set ${varName}=${varValue}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`错误: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program.parse();
