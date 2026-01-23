import React, { useState, useEffect, useCallback } from 'react';
import { AppConfig, ProviderType, DEFAULT_PROVIDERS, ActualEnvStatus } from '../shared/types';
import ProviderPanel from './components/ProviderPanel';
import AddKeyModal from './components/AddKeyModal';
import Header from './components/Header';
import StatusBar from './components/StatusBar';

const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('claude');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualEnvStatus, setActualEnvStatus] = useState<ActualEnvStatus | null>(null);

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
    try {
      const response = await window.electronAPI.addKey(selectedProvider, key, alias, baseUrl);
      if (response.success) {
        await loadConfig();
        await loadActualEnvStatus(selectedProvider);
        setShowAddModal(false);
      } else {
        alert(response.error || '添加失败');
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // 处理删除 Key
  const handleRemoveKey = async (alias: string) => {
    if (!confirm(`确定要删除 Key "${alias}" 吗？`)) {
      return;
    }

    try {
      const response = await window.electronAPI.removeKey(selectedProvider, alias);
      if (response.success) {
        await loadConfig();
        await loadActualEnvStatus(selectedProvider);
      } else {
        alert(response.error || '删除失败');
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // 处理切换 Key
  const handleSwitchKey = async (alias: string) => {
    try {
      const response = await window.electronAPI.switchKey(selectedProvider, alias);
      if (response.success) {
        await loadConfig();
        await loadActualEnvStatus(selectedProvider);
      } else {
        alert(response.error || '切换失败');
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // 处理启用/禁用
  const handleToggleKey = async (alias: string) => {
    try {
      const response = await window.electronAPI.toggleKey(selectedProvider, alias);
      if (response.success) {
        await loadConfig();
      } else {
        alert(response.error || '操作失败');
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // 处理导出
  const handleExport = async () => {
    try {
      const response = await window.electronAPI.exportConfig();
      if (response.success && response.data) {
        alert(`配置已导出到: ${response.data}`);
      } else if (response.error !== '操作已取消') {
        alert(response.error || '导出失败');
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // 处理导入
  const handleImport = async () => {
    try {
      const response = await window.electronAPI.importConfig();
      if (response.success) {
        await loadConfig();
        alert('配置导入成功');
      } else if (response.error !== '操作已取消') {
        alert(response.error || '导入失败');
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // 最小化到托盘
  const handleMinimize = async () => {
    await window.electronAPI.minimizeToTray();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-slate-500">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
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
    <div className="min-h-screen bg-slate-50 pb-14">
      <Header
        onExport={handleExport}
        onImport={handleImport}
        onMinimize={handleMinimize}
      />

      <div className="container mx-auto px-4 py-6">
        {/* 服务商标签页 */}
        <div className="flex space-x-1 mb-6 bg-white rounded-lg p-1 shadow-sm border border-slate-200">
          {Object.entries(DEFAULT_PROVIDERS).map(([id, info]) => (
            <button
              key={id}
              onClick={() => setSelectedProvider(id as ProviderType)}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                selectedProvider === id
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {info.name}
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
          />
        )}
      </div>

      {/* 添加 Key 弹窗 */}
      {showAddModal && (
        <AddKeyModal
          provider={selectedProvider}
          providerInfo={DEFAULT_PROVIDERS[selectedProvider]}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddKey}
        />
      )}

      {/* 底部状态栏 */}
      <StatusBar
        providerConfig={config?.providers[selectedProvider] || null}
        providerInfo={DEFAULT_PROVIDERS[selectedProvider]}
        actualEnvStatus={actualEnvStatus}
      />
    </div>
  );
};

export default App;
