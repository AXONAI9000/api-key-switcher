import React, { useState, useEffect, useCallback } from 'react';
import { AppConfig, ProviderType, DEFAULT_PROVIDERS, ActualEnvStatus, ApiKey, BASE_URL_ENV_MAP } from '../shared/types';
import ProviderPanel from './components/ProviderPanel';
import KeyFormModal from './components/KeyFormModal';
import Header from './components/Header';
import StatusBar from './components/StatusBar';
import { ToastProvider, useToast } from './components/Toast';
import ConfirmModal from './components/ConfirmModal';
import { ThemeProvider } from './components/ThemeContext';
import { SyncProvider, SyncSettings, SyncConflictModal, useSyncContext } from './components/sync';

// Provider icons
const PROVIDER_ICONS: Record<ProviderType, React.ReactNode> = {
  claude: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  ),
  openai: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1685a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4043-.6813zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
    </svg>
  ),
  gemini: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  ),
  deepseek: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
    </svg>
  ),
  custom: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
    </svg>
  ),
};

const AppContent: React.FC = () => {
  const { showToast } = useToast();
  const { pendingConflict, resolveConflict } = useSyncContext();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('claude');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualEnvStatus, setActualEnvStatus] = useState<ActualEnvStatus | null>(null);

  // Loading states for async operations
  const [isAdding, setIsAdding] = useState(false);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // 加载实际环境变量状态
  const loadActualEnvStatus = useCallback(async (provider: ProviderType) => {
    try {
      const response = await window.electronAPI.getActualEnv(provider);
      if (response.success && response.data) {
        setActualEnvStatus(response.data);
      }
    } catch (err) {
      console.error('Failed to load actual env status:', err);
    }
  }, []);

  // 加载配置
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await window.electronAPI.getConfig();
      if (response.success && response.data) {
        setConfig(response.data);
        setError(null);
      } else {
        setError(response.error || '加载配置失败');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadConfig();

    // 监听配置更新事件（来自托盘菜单操作）
    const unsubscribe = window.electronAPI.onConfigUpdated(() => {
      loadConfig();
      loadActualEnvStatus(selectedProvider);
    });

    return () => {
      unsubscribe();
    };
  }, [loadConfig, loadActualEnvStatus, selectedProvider]);

  // 当选择的服务商变化时，加载对应的实际环境变量状态
  useEffect(() => {
    loadActualEnvStatus(selectedProvider);
  }, [selectedProvider, loadActualEnvStatus]);

  // 处理添加 Key
  const handleAddKey = async (key: string, alias: string, baseUrl?: string) => {
    setIsAdding(true);
    try {
      const response = await window.electronAPI.addKey(selectedProvider, key, alias, baseUrl);
      if (response.success) {
        await loadConfig();
        setShowAddModal(false);
        showToast('success', 'API Key 添加成功');
      } else {
        showToast('error', response.error || '添加失败');
      }
    } catch (err) {
      showToast('error', (err as Error).message);
    } finally {
      setIsAdding(false);
    }
  };

  // 处理删除 Key
  const handleRemoveKey = async (alias: string) => {
    setConfirmModal({
      isOpen: true,
      title: '删除 API Key',
      message: `确定要删除 Key "${alias}" 吗？此操作无法撤销。`,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsRemoving(alias);
        try {
          const response = await window.electronAPI.removeKey(selectedProvider, alias);
          if (response.success) {
            await loadConfig();
            if (actualEnvStatus?.matchedAlias === alias) {
              setActualEnvStatus({
                envValue: null,
                matchedAlias: null,
                isManuallyModified: false,
              });
            }
            showToast('success', 'API Key 已删除');
          } else {
            showToast('error', response.error || '删除失败');
          }
        } catch (err) {
          showToast('error', (err as Error).message);
        } finally {
          setIsRemoving(null);
        }
      },
    });
  };

  // 处理切换 Key
  const handleSwitchKey = async (alias: string) => {
    setIsSwitching(alias);
    try {
      const response = await window.electronAPI.switchKey(selectedProvider, alias);
      if (response.success) {
        await loadConfig();
        await loadActualEnvStatus(selectedProvider);
        showToast('success', `已切换到 ${alias}`);
      } else {
        showToast('error', response.error || '切换失败');
      }
    } catch (err) {
      showToast('error', (err as Error).message);
    } finally {
      setIsSwitching(null);
    }
  };

  // 处理启用/禁用
  const handleToggleKey = async (alias: string) => {
    setIsToggling(alias);
    try {
      const response = await window.electronAPI.toggleKey(selectedProvider, alias);
      if (response.success) {
        await loadConfig();
        showToast('success', '状态已更新');
      } else {
        showToast('error', response.error || '操作失败');
      }
    } catch (err) {
      showToast('error', (err as Error).message);
    } finally {
      setIsToggling(null);
    }
  };

  // 处理编辑 Key（打开编辑模态框）
  const handleEditKey = (alias: string) => {
    const key = config?.providers[selectedProvider].keys.find((k) => k.alias === alias);
    if (key) {
      setEditingKey(key);
    }
  };

  // 处理更新 Key
  const handleUpdateKey = async (key: string, alias: string, baseUrl?: string) => {
    if (!editingKey) return;

    setIsUpdating(true);
    try {
      // 构建 extraEnvVars
      let extraEnvVars: Record<string, string> | undefined;
      if (baseUrl) {
        const baseUrlEnvName = BASE_URL_ENV_MAP[selectedProvider];
        if (baseUrlEnvName) {
          extraEnvVars = { [baseUrlEnvName]: baseUrl };
        }
      }

      const response = await window.electronAPI.updateKey(selectedProvider, editingKey.alias, {
        key,
        extraEnvVars,
      });

      if (response.success) {
        await loadConfig();
        await loadActualEnvStatus(selectedProvider);
        setEditingKey(null);
        showToast('success', 'API Key 已更新');
      } else {
        showToast('error', response.error || '更新失败');
      }
    } catch (err) {
      showToast('error', (err as Error).message);
    } finally {
      setIsUpdating(false);
    }
  };

  // 处理重排序
  const handleReorderKeys = async (aliases: string[]) => {
    try {
      const response = await window.electronAPI.reorderKeys(selectedProvider, aliases);
      if (response.success) {
        await loadConfig();
      } else {
        showToast('error', response.error || '排序失败');
      }
    } catch (err) {
      showToast('error', (err as Error).message);
    }
  };

  // 处理导出
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await window.electronAPI.exportConfig();
      if (response.success && response.data) {
        showToast('success', `配置已导出到: ${response.data}`);
      } else if (response.error !== '操作已取消') {
        showToast('error', response.error || '导出失败');
      }
    } catch (err) {
      showToast('error', (err as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  // 处理导入
  const handleImport = async () => {
    setIsImporting(true);
    try {
      const response = await window.electronAPI.importConfig();
      if (response.success) {
        await loadConfig();
        showToast('success', '配置导入成功');
      } else if (response.error !== '操作已取消') {
        showToast('error', response.error || '导入失败');
      }
    } catch (err) {
      showToast('error', (err as Error).message);
    } finally {
      setIsImporting(false);
    }
  };

  // 最小化到托盘
  const handleMinimize = async () => {
    await window.electronAPI.minimizeToTray();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-lg text-slate-500 dark:text-slate-400">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="text-lg text-red-500 mb-4">加载失败: {error}</div>
          <button onClick={loadConfig} className="btn btn-primary">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-14 transition-colors duration-200">
      <Header
        onExport={handleExport}
        onImport={handleImport}
        onMinimize={handleMinimize}
        onSyncClick={() => setShowSyncSettings(true)}
      />

      <div className="container mx-auto px-4 py-6">
        {/* 服务商标签页 */}
        <div className="flex space-x-1 mb-6 bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-200">
          {Object.entries(DEFAULT_PROVIDERS).map(([id, info]) => (
            <button
              key={id}
              onClick={() => setSelectedProvider(id as ProviderType)}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                selectedProvider === id
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {PROVIDER_ICONS[id as ProviderType]}
              <span className="hidden sm:inline">{info.name}</span>
            </button>
          ))}
        </div>

        {/* 当前服务商面板 */}
        {config && (
          <ProviderPanel
            provider={selectedProvider}
            providerConfig={config.providers[selectedProvider]}
            providerInfo={DEFAULT_PROVIDERS[selectedProvider]}
            actualEnvStatus={actualEnvStatus}
            onAddKey={() => setShowAddModal(true)}
            onRemoveKey={handleRemoveKey}
            onSwitchKey={handleSwitchKey}
            onToggleKey={handleToggleKey}
            onEditKey={handleEditKey}
            onReorderKeys={handleReorderKeys}
            isSwitching={isSwitching}
            isToggling={isToggling}
            isRemoving={isRemoving}
          />
        )}
      </div>

      {/* 添加 Key 弹窗 */}
      {showAddModal && (
        <KeyFormModal
          mode="add"
          provider={selectedProvider}
          providerInfo={DEFAULT_PROVIDERS[selectedProvider]}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddKey}
          isLoading={isAdding}
        />
      )}

      {/* 编辑 Key 弹窗 */}
      {editingKey && (
        <KeyFormModal
          mode="edit"
          provider={selectedProvider}
          providerInfo={DEFAULT_PROVIDERS[selectedProvider]}
          onClose={() => setEditingKey(null)}
          onSubmit={handleUpdateKey}
          isLoading={isUpdating}
          initialData={{
            key: editingKey.key,
            alias: editingKey.alias,
            baseUrl: editingKey.extraEnvVars ? Object.values(editingKey.extraEnvVars)[0] : undefined,
          }}
        />
      )}

      {/* 确认删除弹窗 */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="删除"
        cancelText="取消"
        type="danger"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* 底部状态栏 */}
      <StatusBar
        providerConfig={config?.providers[selectedProvider] || null}
        providerInfo={DEFAULT_PROVIDERS[selectedProvider]}
        actualEnvStatus={actualEnvStatus}
      />

      {/* 同步设置弹窗 */}
      <SyncSettings
        isOpen={showSyncSettings}
        onClose={() => setShowSyncSettings(false)}
      />

      {/* 同步冲突弹窗 */}
      {pendingConflict && (
        <SyncConflictModal
          isOpen={true}
          conflictData={pendingConflict}
          onResolve={resolveConflict}
          onClose={() => {}}
        />
      )}
    </div>
  );
};

// Wrap with ThemeProvider, ToastProvider, and SyncProvider
const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <SyncProvider>
          <AppContent />
        </SyncProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
