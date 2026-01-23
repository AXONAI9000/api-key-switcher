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
import {
  IPC_CHANNELS,
  ProviderType,
  DEFAULT_PROVIDERS,
  IpcResponse,
  ApiKey,
  AppConfig,
  ActualEnvStatus,
} from '../shared/types';

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
      updates: Partial<Pick<ApiKey, 'alias' | 'key' | 'enabled'>>
    ): IpcResponse<ApiKey> => {
      try {
        const updatedKey = updateKey(provider, alias, updates);
        updateTrayMenu();
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
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  setupIpcHandlers();
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
