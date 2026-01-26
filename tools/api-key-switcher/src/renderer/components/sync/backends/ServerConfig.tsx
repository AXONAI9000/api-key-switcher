/**
 * 自建服务器配置组件
 */

import React, { useState } from 'react';
import type { ServerSyncConfig } from '../../../../shared/sync/types';

interface ServerConfigProps {
  config: ServerSyncConfig | undefined;
  onChange: (config: ServerSyncConfig) => void;
  onTest: () => Promise<{ success: boolean; error?: string }>;
}

const ServerConfig: React.FC<ServerConfigProps> = ({ config, onChange, onTest }) => {
  const [url, setUrl] = useState(config?.url || '');
  const [token, setToken] = useState(config?.token || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    onChange({ url: newUrl, token });
    setTestResult(null);
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newToken = e.target.value;
    setToken(newToken);
    onChange({ url, token: newToken });
    setTestResult(null);
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
          服务器地址
        </label>
        <input
          type="url"
          value={url}
          onChange={handleUrlChange}
          placeholder="https://your-sync-server.com"
          className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
            focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          输入您部署的同步服务器 URL
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          访问令牌
        </label>
        <input
          type="password"
          value={token}
          onChange={handleTokenChange}
          placeholder="your-access-token"
          className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
            focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          在服务器配置中生成的访问令牌
        </p>
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={handleTest}
          disabled={!url || !token || testing}
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
    </div>
  );
};

export default ServerConfig;
