/**
 * WebDAV 配置组件
 */

import React, { useState } from 'react';
import type { WebDAVSyncConfig } from '../../../../shared/sync/types';

interface WebDAVConfigProps {
  config: WebDAVSyncConfig | undefined;
  onChange: (config: WebDAVSyncConfig) => void;
  onTest: () => Promise<{ success: boolean; error?: string }>;
}

// WebDAV 预设服务商
const PRESETS = [
  { id: 'custom', name: '自定义', url: '', path: '/api-key-switcher' },
  { id: 'jianguoyun', name: '坚果云', url: 'https://dav.jianguoyun.com/dav', path: '/api-key-switcher' },
  { id: 'nextcloud', name: 'Nextcloud', url: '', path: '/remote.php/dav/files/{username}/api-key-switcher' },
];

const WebDAVConfig: React.FC<WebDAVConfigProps> = ({ config, onChange, onTest }) => {
  const [preset, setPreset] = useState('custom');
  const [url, setUrl] = useState(config?.url || '');
  const [username, setUsername] = useState(config?.username || '');
  const [password, setPassword] = useState(config?.password || '');
  const [path, setPath] = useState(config?.path || '/api-key-switcher');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const updateConfig = (updates: Partial<WebDAVSyncConfig>) => {
    const newConfig = {
      url: updates.url ?? url,
      username: updates.username ?? username,
      password: updates.password ?? password,
      path: updates.path ?? path,
    };
    onChange(newConfig);
    setTestResult(null);
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedPreset = PRESETS.find(p => p.id === e.target.value);
    if (selectedPreset) {
      setPreset(selectedPreset.id);
      if (selectedPreset.url) {
        setUrl(selectedPreset.url);
      }
      setPath(selectedPreset.path);
      updateConfig({ url: selectedPreset.url || url, path: selectedPreset.path });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          服务商预设
        </label>
        <select
          value={preset}
          onChange={handlePresetChange}
          className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
            focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          {PRESETS.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          WebDAV URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); updateConfig({ url: e.target.value }); }}
          placeholder="https://your-webdav-server.com"
          className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
            focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            用户名
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => { setUsername(e.target.value); updateConfig({ username: e.target.value }); }}
            placeholder="用户名"
            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600
              bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
              focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            密码
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); updateConfig({ password: e.target.value }); }}
            placeholder="密码或应用专用密码"
            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600
              bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
              focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          存储路径
        </label>
        <input
          type="text"
          value={path}
          onChange={(e) => { setPath(e.target.value); updateConfig({ path: e.target.value }); }}
          placeholder="/api-key-switcher"
          className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
            focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          配置文件将存储在此路径下
        </p>
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={handleTest}
          disabled={!url || !username || !password || testing}
          className="btn btn-secondary flex items-center space-x-2"
        >
          {testing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>测试中...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>测试连接</span>
            </>
          )}
        </button>

        {testResult && (
          <span className={`text-sm ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
            {testResult.success ? '连接成功' : testResult.error || '连接失败'}
          </span>
        )}
      </div>

      {preset === 'jianguoyun' && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            <strong>坚果云提示：</strong>请使用应用专用密码而非登录密码。
            在坚果云 → 账户信息 → 安全选项中创建。
          </p>
        </div>
      )}
    </div>
  );
};

export default WebDAVConfig;
