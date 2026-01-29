/**
 * 同步设置主面板
 */

import React, { useState, useEffect } from 'react';
import type { SyncConfig, SyncBackendType, ServerSyncConfig, GistSyncConfig, WebDAVSyncConfig } from '../../../shared/sync/types';
import { useSyncContext } from './SyncContext';
import ServerConfig from './backends/ServerConfig';
import GistConfig from './backends/GistConfig';
import WebDAVConfig from './backends/WebDAVConfig';
import MasterPasswordModal from './MasterPasswordModal';

interface SyncSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const BACKEND_OPTIONS: { id: SyncBackendType; name: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'server',
    name: '自建服务器',
    description: '部署到您自己的服务器',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    ),
  },
  {
    id: 'gist',
    name: 'GitHub Gist',
    description: '存储在私有 Gist',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
  {
    id: 'webdav',
    name: 'WebDAV',
    description: '坚果云、Nextcloud 等',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    ),
  },
];

const SyncSettings: React.FC<SyncSettingsProps> = ({ isOpen, onClose }) => {
  const {
    syncConfig,
    isPasswordVerified,
    saveSyncConfig,
    testConnection,
    syncPull,
    syncPush,
    syncExecute,
    setMasterPassword,
    verifyMasterPassword,
  } = useSyncContext();

  const [localConfig, setLocalConfig] = useState<Partial<SyncConfig>>({});
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isFirstTimePassword, setIsFirstTimePassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<'pull' | 'push' | 'sync' | null>(null);

  useEffect(() => {
    if (syncConfig) {
      setLocalConfig(syncConfig);
    }
  }, [syncConfig]);

  const handleBackendChange = (backend: SyncBackendType) => {
    setLocalConfig(prev => ({ ...prev, backendType: backend }));
  };

  const handleServerConfigChange = (config: ServerSyncConfig) => {
    setLocalConfig(prev => ({ ...prev, serverConfig: config }));
  };

  const handleGistConfigChange = (config: GistSyncConfig) => {
    setLocalConfig(prev => ({ ...prev, gistConfig: config }));
  };

  const handleWebDAVConfigChange = (config: WebDAVSyncConfig) => {
    setLocalConfig(prev => ({ ...prev, webdavConfig: config }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSyncConfig(localConfig);
    } finally {
      setSaving(false);
    }
  };

  const handleEnableSync = async () => {
    // 先检查是否需要设置或验证主密码
    const result = await verifyMasterPassword('');
    if (result.isFirstTime) {
      setIsFirstTimePassword(true);
      setShowPasswordModal(true);
    } else if (!isPasswordVerified) {
      setIsFirstTimePassword(false);
      setShowPasswordModal(true);
    } else {
      setLocalConfig(prev => ({ ...prev, enabled: true }));
    }
  };

  const handlePasswordSubmit = async (password: string): Promise<boolean> => {
    if (isFirstTimePassword) {
      const success = await setMasterPassword(password);
      if (success) {
        setShowPasswordModal(false);
        setLocalConfig(prev => ({ ...prev, enabled: true }));
      }
      return success;
    } else {
      const result = await verifyMasterPassword(password);
      if (result.valid) {
        setShowPasswordModal(false);
        setLocalConfig(prev => ({ ...prev, enabled: true }));
      }
      return result.valid;
    }
  };

  const handleSync = async (type: 'pull' | 'push' | 'sync') => {
    if (!isPasswordVerified) {
      setIsFirstTimePassword(false);
      setShowPasswordModal(true);
      return;
    }

    setSyncing(type);
    try {
      if (type === 'pull') {
        await syncPull();
      } else if (type === 'push') {
        await syncPush();
      } else {
        await syncExecute();
      }
    } finally {
      setSyncing(null);
    }
  };

  if (!isOpen) return null;

  const currentBackend = localConfig.backendType || 'server';

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
          {/* 头部 */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">同步设置</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">配置跨设备同步</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 内容 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* 启用开关 */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div>
                <h3 className="font-medium text-slate-800 dark:text-slate-100">启用同步</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  开启后可在多设备间同步 API Key 配置
                </p>
              </div>
              <button
                onClick={() => localConfig.enabled ? setLocalConfig(prev => ({ ...prev, enabled: false })) : handleEnableSync()}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  localConfig.enabled ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    localConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {localConfig.enabled && (
              <>
                {/* 后端选择 */}
                <div>
                  <h3 className="font-medium text-slate-800 dark:text-slate-100 mb-3">同步后端</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {BACKEND_OPTIONS.map(option => (
                      <button
                        key={option.id}
                        onClick={() => handleBackendChange(option.id)}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          currentBackend === option.id
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className={`mb-2 ${currentBackend === option.id ? 'text-primary-500' : 'text-slate-500'}`}>
                          {option.icon}
                        </div>
                        <p className={`font-medium text-sm ${
                          currentBackend === option.id
                            ? 'text-primary-700 dark:text-primary-300'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}>
                          {option.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 后端配置 */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  {currentBackend === 'server' && (
                    <ServerConfig
                      config={localConfig.serverConfig}
                      onChange={handleServerConfigChange}
                      onTest={testConnection}
                    />
                  )}
                  {currentBackend === 'gist' && (
                    <GistConfig
                      config={localConfig.gistConfig}
                      onChange={handleGistConfigChange}
                      onTest={testConnection}
                    />
                  )}
                  {currentBackend === 'webdav' && (
                    <WebDAVConfig
                      config={localConfig.webdavConfig}
                      onChange={handleWebDAVConfigChange}
                      onTest={testConnection}
                    />
                  )}
                </div>

                {/* 自动同步 */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-slate-800 dark:text-slate-100">自动同步</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">定期自动同步配置</p>
                    </div>
                    <button
                      onClick={() => setLocalConfig(prev => ({ ...prev, autoSync: !prev.autoSync }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        localConfig.autoSync ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          localConfig.autoSync ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {localConfig.autoSync && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-slate-600 dark:text-slate-400">每</span>
                      <select
                        value={localConfig.autoSyncInterval || 30}
                        onChange={(e) => setLocalConfig(prev => ({ ...prev, autoSyncInterval: Number(e.target.value) }))}
                        className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600
                          bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                      >
                        <option value={5}>5</option>
                        <option value={15}>15</option>
                        <option value={30}>30</option>
                        <option value={60}>60</option>
                      </select>
                      <span className="text-sm text-slate-600 dark:text-slate-400">分钟同步一次</span>
                    </div>
                  )}
                </div>

                {/* 手动同步 */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <h3 className="font-medium text-slate-800 dark:text-slate-100 mb-3">手动同步</h3>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleSync('pull')}
                      disabled={syncing !== null}
                      className="btn btn-secondary flex items-center space-x-2"
                    >
                      {syncing === 'pull' ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      )}
                      <span>拉取</span>
                    </button>
                    <button
                      onClick={() => handleSync('push')}
                      disabled={syncing !== null}
                      className="btn btn-secondary flex items-center space-x-2"
                    >
                      {syncing === 'push' ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      )}
                      <span>推送</span>
                    </button>
                    <button
                      onClick={() => handleSync('sync')}
                      disabled={syncing !== null}
                      className="btn btn-primary flex items-center space-x-2"
                    >
                      {syncing === 'sync' ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                      <span>同步</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 底部 */}
          <div className="flex justify-end space-x-3 p-4 border-t border-slate-200 dark:border-slate-700">
            <button onClick={onClose} className="btn btn-ghost">
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? '保存中...' : '保存设置'}
            </button>
          </div>
        </div>
      </div>

      <MasterPasswordModal
        isOpen={showPasswordModal}
        isFirstTime={isFirstTimePassword}
        onClose={() => setShowPasswordModal(false)}
        onSubmit={handlePasswordSubmit}
      />
    </>
  );
};

export default SyncSettings;
