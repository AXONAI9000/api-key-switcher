import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  dialog,
  NativeImage,
} from 'electron';
import * as path from 'path';
import {
  loadConfig,
  saveConfig,
  removeKey,
  updateKey,
  toggleKey,
  getCurrentKey,
  exportConfig,
  importConfig,
  maskKey,
  addKeyWithExtras,
  switchKeyAndApply,
  getUserEnvVar,
  reorderKeys,
} from '../shared/config-manager';
import { getConfigCache } from '../shared/config-cache';
import {
  IPC_CHANNELS,
  ProviderType,
  DEFAULT_PROVIDERS,
  IpcResponse,
  ApiKey,
  AppConfig,
  ActualEnvStatus,
} from '../shared/types';
import {
  getSyncManager,
  SyncConfig,
  SyncResult,
  SyncStatus,
  ConflictResolution,
  SyncManagerState,
  MasterPasswordResult,
} from '../shared/sync';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV === 'development';

// 获取资源路径（兼容开发和打包环境）
function getAssetPath(filename: string): string {
  if (isDev) {
    return path.join(__dirname, '../../../assets', filename);
  }
  // 打包后资源在 app.asar 同级的 assets 目录或 resources 目录
  return path.join(process.resourcesPath, 'assets', filename);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: getAssetPath('icon.png'),
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // 仅在开发模式下打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTrayIcon(): NativeImage {
  // 加载托盘图标
  const iconPath = getAssetPath('tray-icon.png');
  let trayIcon = nativeImage.createFromPath(iconPath);

  // 如果图标加载失败，创建一个简单的后备图标
  if (trayIcon.isEmpty()) {
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const x = i % size;
      const y = Math.floor(i / size);
      const idx = i * 4;
      const centerX = size / 2;
      const centerY = size / 2;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

      if (dist < 6) {
        // 金色圆形
        canvas[idx] = 255;     // R
        canvas[idx + 1] = 193; // G
        canvas[idx + 2] = 7;   // B
        canvas[idx + 3] = 255; // A
      } else {
        canvas[idx] = 0;
        canvas[idx + 1] = 0;
        canvas[idx + 2] = 0;
        canvas[idx + 3] = 0;
      }
    }
    trayIcon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }

  return trayIcon;
}

function createTray(): void {
  const trayIcon = createTrayIcon();

  tray = new Tray(trayIcon);
  tray.setToolTip('API Key Switcher');

  updateTrayMenu();

  tray.on('double-click', () => {
    mainWindow?.show();
  });
}

function updateTrayMenu(): void {
  if (!tray) return;

  const config = loadConfig();
  const menuItems: Electron.MenuItemConstructorOptions[] = [];

  // 添加各服务商的快速切换菜单
  for (const [providerId, providerInfo] of Object.entries(DEFAULT_PROVIDERS)) {
    const providerConfig = config.providers[providerId as ProviderType];
    if (!providerConfig || providerConfig.keys.length === 0) continue;

    const submenu: Electron.MenuItemConstructorOptions[] = providerConfig.keys
      .filter((key) => key.enabled)
      .map((key) => ({
        label: `${key.alias}${providerConfig.currentKey === key.alias ? ' ✓' : ''}`,
        type: 'radio' as const,
        checked: providerConfig.currentKey === key.alias,
        click: () => {
          switchKeyAndApply(providerId as ProviderType, key.alias);
          updateTrayMenu();
          mainWindow?.webContents.send('config-updated');
        },
      }));

    if (submenu.length > 0) {
      menuItems.push({
        label: providerInfo.name,
        submenu,
      });
    }
  }

  if (menuItems.length > 0) {
    menuItems.push({ type: 'separator' });
  }

  menuItems.push(
    {
      label: '显示主窗口',
      click: () => {
        mainWindow?.show();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    }
  );

  const contextMenu = Menu.buildFromTemplate(menuItems);
  tray.setContextMenu(contextMenu);
}

// IPC 处理器
function setupIpcHandlers(): void {
  // 获取配置
  ipcMain.handle(IPC_CHANNELS.GET_CONFIG, (): IpcResponse<AppConfig> => {
    try {
      const config = loadConfig();
      return { success: true, data: config };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 保存配置
  ipcMain.handle(
    IPC_CHANNELS.SAVE_CONFIG,
    (_, config: AppConfig): IpcResponse => {
      try {
        saveConfig(config);
        updateTrayMenu();
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 添加 Key
  ipcMain.handle(
    IPC_CHANNELS.ADD_KEY,
    (
      _,
      provider: ProviderType,
      key: string,
      alias?: string,
      baseUrl?: string
    ): IpcResponse<ApiKey> => {
      try {
        // 构建额外环境变量
        let extraEnvVars: Record<string, string> | undefined;
        if (baseUrl) {
          const baseUrlEnvMap: Record<string, string> = {
            claude: 'ANTHROPIC_BASE_URL',
            openai: 'OPENAI_BASE_URL',
            gemini: 'GOOGLE_API_BASE_URL',
            deepseek: 'DEEPSEEK_BASE_URL',
            custom: 'CUSTOM_BASE_URL',
          };
          const envName = baseUrlEnvMap[provider];
          if (envName) {
            extraEnvVars = { [envName]: baseUrl };
          }
        }

        const newKey = addKeyWithExtras(provider, key, alias, extraEnvVars);
        updateTrayMenu();
        return { success: true, data: newKey };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 删除 Key
  ipcMain.handle(
    IPC_CHANNELS.REMOVE_KEY,
    (_, provider: ProviderType, alias: string): IpcResponse => {
      try {
        removeKey(provider, alias);
        updateTrayMenu();
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 更新 Key
  ipcMain.handle(
    IPC_CHANNELS.UPDATE_KEY,
    (
      _,
      provider: ProviderType,
      alias: string,
      updates: Partial<Pick<ApiKey, 'alias' | 'key' | 'enabled' | 'extraEnvVars'>>
    ): IpcResponse<ApiKey> => {
      try {
        const config = loadConfig();
        const isCurrent = config.providers[provider].currentKey === alias;

        const updatedKey = updateKey(provider, alias, updates);
        updateTrayMenu();

        // 如果编辑的是当前使用的 Key，自动更新环境变量
        if (isCurrent) {
          const appliedVars: Record<string, string> = {};
          const envVarName = config.providers[provider].envVar;

          // 主 API Key
          appliedVars[envVarName] = updatedKey.key;

          // 额外的环境变量（如 BASE_URL）
          if (updatedKey.extraEnvVars) {
            for (const [varName, varValue] of Object.entries(updatedKey.extraEnvVars)) {
              appliedVars[varName] = varValue;
            }
          }

          // 批量设置环境变量
          const { setUserEnvVarsBatch } = require('../shared/config-manager');
          setUserEnvVarsBatch(appliedVars);
        }

        return { success: true, data: updatedKey };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 切换启用/禁用
  ipcMain.handle(
    IPC_CHANNELS.TOGGLE_KEY,
    (_, provider: ProviderType, alias: string): IpcResponse<{ enabled: boolean }> => {
      try {
        const result = toggleKey(provider, alias);
        updateTrayMenu();
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 切换当前 Key（自动应用环境变量）
  ipcMain.handle(
    IPC_CHANNELS.SWITCH_KEY,
    (_, provider: ProviderType, alias: string): IpcResponse<{ appliedVars: Record<string, string> }> => {
      try {
        const result = switchKeyAndApply(provider, alias);
        updateTrayMenu();
        return { success: true, data: { appliedVars: result.appliedVars } };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 重新排序 Keys
  ipcMain.handle(
    IPC_CHANNELS.REORDER_KEYS,
    (_, provider: ProviderType, aliases: string[]): IpcResponse<ApiKey[]> => {
      try {
        const reorderedKeys = reorderKeys(provider, aliases);
        updateTrayMenu();
        return { success: true, data: reorderedKeys };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 验证 Key 有效性
  ipcMain.handle(
    IPC_CHANNELS.VALIDATE_KEY,
    async (_event, provider: ProviderType, key: string, baseUrl?: string): Promise<IpcResponse> => {
      try {
        const { validateApiKey } = await import('../shared/key-validator');
        const result = await validateApiKey(provider, key, baseUrl);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 获取 Key 统计
  ipcMain.handle(
    IPC_CHANNELS.GET_KEY_STATS,
    async (_event, provider: ProviderType): Promise<IpcResponse> => {
      try {
        const { getStats } = await import('../shared/usage-tracker');
        const stats = getStats(provider);
        return { success: true, data: stats };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 设置 Key 过期时间
  ipcMain.handle(
    IPC_CHANNELS.SET_KEY_EXPIRY,
    async (_event, provider: ProviderType, alias: string, expiresAt: string): Promise<IpcResponse> => {
      try {
        const { setExpiry } = await import('../shared/usage-tracker');
        setExpiry(provider, alias, expiresAt);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 清除 Key 过期时间
  ipcMain.handle(
    IPC_CHANNELS.CLEAR_KEY_EXPIRY,
    async (_event, provider: ProviderType, alias: string): Promise<IpcResponse> => {
      try {
        const { clearExpiry } = await import('../shared/usage-tracker');
        clearExpiry(provider, alias);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 获取当前环境变量值
  ipcMain.handle(
    IPC_CHANNELS.GET_CURRENT_ENV,
    (_, provider: ProviderType): IpcResponse<{ alias: string; key: string; masked: string } | null> => {
      try {
        const current = getCurrentKey(provider);
        if (current) {
          return {
            success: true,
            data: {
              ...current,
              masked: maskKey(current.key),
            },
          };
        }
        return { success: true, data: null };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 获取实际系统环境变量状态
  ipcMain.handle(
    IPC_CHANNELS.GET_ACTUAL_ENV,
    (_, provider: ProviderType): IpcResponse<ActualEnvStatus> => {
      try {
        const config = loadConfig();
        const providerConfig = config.providers[provider];

        if (!providerConfig) {
          return {
            success: true,
            data: {
              envValue: null,
              matchedAlias: null,
              isManuallyModified: false,
            },
          };
        }

        // 读取实际的系统环境变量
        const envVarName = providerConfig.envVar;
        const actualValue = getUserEnvVar(envVarName);

        if (!actualValue) {
          return {
            success: true,
            data: {
              envValue: null,
              matchedAlias: null,
              isManuallyModified: false,
            },
          };
        }

        // 在配置的 keys 中查找匹配的
        const matchedKey = providerConfig.keys.find((k) => k.key === actualValue);

        return {
          success: true,
          data: {
            envValue: actualValue,
            matchedAlias: matchedKey?.alias || null,
            isManuallyModified: !matchedKey, // 如果没有匹配的 key，说明被手动修改了
          },
        };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 导出配置
  ipcMain.handle(IPC_CHANNELS.EXPORT_CONFIG, async (): Promise<IpcResponse<string>> => {
    try {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: '导出配置',
        defaultPath: 'api-key-switcher-config.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: '操作已取消' };
      }

      exportConfig(result.filePath);
      return { success: true, data: result.filePath };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 导入配置
  ipcMain.handle(IPC_CHANNELS.IMPORT_CONFIG, async (): Promise<IpcResponse<AppConfig>> => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: '导入配置',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: '操作已取消' };
      }

      const config = importConfig(result.filePaths[0]);
      updateTrayMenu();
      return { success: true, data: config };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 最小化到托盘
  ipcMain.handle(IPC_CHANNELS.MINIMIZE_TO_TRAY, (): IpcResponse => {
    mainWindow?.hide();
    return { success: true };
  });

  // 显示窗口
  ipcMain.handle(IPC_CHANNELS.SHOW_WINDOW, (): IpcResponse => {
    mainWindow?.show();
    return { success: true };
  });

  // 关闭窗口
  ipcMain.handle(IPC_CHANNELS.CLOSE_WINDOW, (): IpcResponse => {
    mainWindow?.hide();
    return { success: true };
  });

  // ========== 同步相关 IPC 处理器 ==========

  const syncManager = getSyncManager();

  // 监听同步状态变更，通知渲染进程
  syncManager.addStatusListener((event) => {
    mainWindow?.webContents.send(IPC_CHANNELS.SYNC_STATUS_CHANGED, event);
  });

  // 获取同步配置
  ipcMain.handle(IPC_CHANNELS.SYNC_GET_CONFIG, (): IpcResponse<SyncConfig> => {
    try {
      const config = syncManager.getSyncConfig();
      return { success: true, data: config };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 保存同步配置
  ipcMain.handle(
    IPC_CHANNELS.SYNC_SAVE_CONFIG,
    async (_, config: Partial<SyncConfig>): Promise<IpcResponse> => {
      try {
        await syncManager.updateSyncConfig(config);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 测试连接
  ipcMain.handle(
    IPC_CHANNELS.SYNC_TEST_CONNECTION,
    async (): Promise<IpcResponse<{ connected: boolean }>> => {
      try {
        const result = await syncManager.testConnection();
        return { success: result.success, data: { connected: result.success }, error: result.error };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 拉取配置
  ipcMain.handle(
    IPC_CHANNELS.SYNC_PULL,
    async (): Promise<IpcResponse<SyncResult>> => {
      try {
        // 同步前先 flush 缓存，确保磁盘数据是最新的
        getConfigCache().flush();
        const localConfig = loadConfig();
        const result = await syncManager.pull(localConfig);
        return { success: result.success, data: result, error: result.error };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 推送配置
  ipcMain.handle(
    IPC_CHANNELS.SYNC_PUSH,
    async (): Promise<IpcResponse<SyncResult>> => {
      try {
        // 同步前先 flush 缓存，确保推送的是最新数据
        getConfigCache().flush();
        const localConfig = loadConfig();
        const result = await syncManager.push(localConfig);
        return { success: result.success, data: result, error: result.error };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 执行同步（双向）
  ipcMain.handle(
    IPC_CHANNELS.SYNC_EXECUTE,
    async (): Promise<IpcResponse<SyncResult>> => {
      try {
        // 同步前先 flush 缓存，确保磁盘数据与内存一致
        getConfigCache().flush();
        const localConfig = loadConfig();
        const result = await syncManager.sync(localConfig);

        // 如果同步成功且有远程更新，invalidate 缓存并通知渲染进程刷新
        if (result.success) {
          getConfigCache().invalidate();
          mainWindow?.webContents.send('config-updated');
        }

        return { success: result.success, data: result, error: result.error };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 获取同步状态
  ipcMain.handle(
    IPC_CHANNELS.SYNC_GET_STATUS,
    (): IpcResponse<SyncManagerState> => {
      try {
        const state = syncManager.getState();
        return { success: true, data: state };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 解决冲突
  ipcMain.handle(
    IPC_CHANNELS.SYNC_RESOLVE_CONFLICT,
    async (_, resolution: ConflictResolution): Promise<IpcResponse<AppConfig | null>> => {
      try {
        // 冲突解决前先 flush 缓存
        getConfigCache().flush();
        const localConfig = loadConfig();
        const result = await syncManager.resolveConflict(resolution, localConfig);

        if (result.success && result.config) {
          // 如果解决冲突后配置有变化，保存并通知
          if (resolution !== 'local') {
            saveConfig(result.config);
            // 立即 flush 确保磁盘写入，然后 invalidate 让下次读取从磁盘加载
            getConfigCache().flush();
            updateTrayMenu();
            mainWindow?.webContents.send('config-updated');
          }
          return { success: true, data: result.config };
        }

        return { success: false, error: result.error };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 设置主密码
  ipcMain.handle(
    IPC_CHANNELS.SYNC_SET_MASTER_PASSWORD,
    async (_, password: string): Promise<IpcResponse> => {
      try {
        const result = await syncManager.setMasterPassword(password);
        return { success: result.success, error: result.error };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 验证主密码
  ipcMain.handle(
    IPC_CHANNELS.SYNC_VERIFY_MASTER_PASSWORD,
    async (_, password: string): Promise<IpcResponse<MasterPasswordResult>> => {
      try {
        const result = await syncManager.verifyMasterPassword(password);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 初始化同步管理器
  syncManager.initialize().catch((error) => {
    console.error('Failed to initialize sync manager:', error);
  });

  // ========== Claude Code 更新相关 ==========

  // 从 claude --version 输出中提取纯版本号（如 "2.1.63 (Claude Code)" → "2.1.63"）
  const extractVersion = (versionOutput: string): string => {
    const match = versionOutput.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : versionOutput.trim();
  };

  // 获取 Claude Code 当前版本
  ipcMain.handle(IPC_CHANNELS.CLAUDE_GET_VERSION, async (): Promise<IpcResponse<{ version: string }>> => {
    try {
      const { execSync } = require('child_process');
      const raw = execSync('claude --version', { encoding: 'utf-8', timeout: 10000 }).trim();
      return { success: true, data: { version: raw } };
    } catch (error) {
      return { success: false, error: '无法获取 Claude Code 版本，请确认已安装 Claude Code' };
    }
  });

  // 检查并更新 Claude Code
  ipcMain.handle(IPC_CHANNELS.CLAUDE_UPDATE, async (): Promise<IpcResponse<{ needUpdate: boolean; currentVersion: string; oldVersion?: string; newVersion?: string }>> => {
    try {
      const { execSync } = require('child_process');

      // 获取本地版本
      let localRaw: string;
      try {
        localRaw = execSync('claude --version', { encoding: 'utf-8', timeout: 10000 }).trim();
      } catch {
        return { success: false, error: '无法获取本地 Claude Code 版本，请确认已安装' };
      }

      // 获取远程最新版本
      let remoteVersion: string;
      try {
        remoteVersion = execSync('npm view @anthropic-ai/claude-code version --registry=https://registry.npmmirror.com/', { encoding: 'utf-8', timeout: 30000 }).trim();
      } catch {
        return { success: false, error: '无法获取远程版本信息，请检查网络连接' };
      }

      // 提取纯版本号进行比较
      const localVersion = extractVersion(localRaw);
      const cleanRemote = remoteVersion.replace(/^v/, '');

      if (localVersion === cleanRemote) {
        return { success: true, data: { needUpdate: false, currentVersion: localRaw } };
      }

      // 执行更新
      try {
        execSync('npm install -g @anthropic-ai/claude-code --registry=https://registry.npmmirror.com/', { encoding: 'utf-8', timeout: 120000 });
      } catch (installError) {
        return { success: false, error: `更新失败: ${(installError as Error).message}` };
      }

      // 获取更新后的版本
      let newRaw: string;
      try {
        newRaw = execSync('claude --version', { encoding: 'utf-8', timeout: 10000 }).trim();
      } catch {
        newRaw = remoteVersion;
      }

      return { success: true, data: { needUpdate: true, oldVersion: localRaw, newVersion: newRaw, currentVersion: newRaw } };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}

app.whenReady().then(async () => {
  createWindow();
  createTray();
  setupIpcHandlers();

  // 每小时检查一次 Key 过期
  const checkKeyExpiry = async () => {
    try {
      const { getExpiringKeys, getExpiredKeys } = await import('../shared/usage-tracker');
      const expired = getExpiredKeys();
      const expiring = getExpiringKeys();

      if (expired.length > 0) {
        const { Notification } = await import('electron');
        if (Notification.isSupported()) {
          new Notification({
            title: 'API Key 已过期',
            body: `${expired.map((k: any) => k.alias).join(', ')} 已过期，请及时更换`,
          }).show();
        }
      }

      if (expiring.length > 0) {
        const { Notification } = await import('electron');
        if (Notification.isSupported()) {
          new Notification({
            title: 'API Key 即将过期',
            body: `${expiring.map((k: any) => k.alias).join(', ')} 将在 7 天内过期`,
          }).show();
        }
      }
    } catch (error) {
      console.error('Failed to check key expiry:', error);
    }
  };

  // 启动后延迟 5 分钟首次检查，之后每小时检查
  setTimeout(checkKeyExpiry, 5 * 60 * 1000);
  setInterval(checkKeyExpiry, 60 * 60 * 1000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow?.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});
