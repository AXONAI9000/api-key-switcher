/**
 * GitHub Gist 配置组件
 */

import React, { useState } from 'react';
import type { GistSyncConfig } from '../../../../shared/sync/types';

interface GistConfigProps {
  config: GistSyncConfig | undefined;
  onChange: (config: GistSyncConfig) => void;
  onTest: () => Promise<{ success: boolean; error?: string }>;
}

const GistConfig: React.FC<GistConfigProps> = ({ config, onChange, onTest }) => {
  const [token, setToken] = useState(config?.token || '');
  const [gistId, setGistId] = useState(config?.gistId || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newToken = e.target.value;
    setToken(newToken);
    onChange({ token: newToken, gistId: gistId || undefined });
    setTestResult(null);
  };

  const handleGistIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newGistId = e.target.value;
    setGistId(newGistId);
    onChange({ token, gistId: newGistId || undefined });
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
          GitHub Personal Access Token
        </label>
        <input
          type="password"
          value={token}
          onChange={handleTokenChange}
          placeholder="ghp_xxxxxxxxxxxx"
          className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
            focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          需要 <code className="bg-slate-100 dark:bg-slate-600 px-1 rounded">gist</code> 权限。
          <a
            href="https://github.com/settings/tokens/new?scopes=gist&description=API%20Key%20Switcher"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-500 hover:underline ml-1"
          >
            创建 Token
          </a>
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Gist ID（可选）
        </label>
        <input
          type="text"
          value={gistId}
          onChange={handleGistIdChange}
          placeholder="留空将自动创建新 Gist"
          className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
            focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          如果您已有同步用的 Gist，可以在这里填入 ID
        </p>
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={handleTest}
          disabled={!token || testing}
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

      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>提示：</strong>配置会加密后存储在私有 Gist 中，只有您能访问。
        </p>
      </div>
    </div>
  );
};

export default GistConfig;
