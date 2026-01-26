/**
 * 自建服务器配置组件
 */

import React, { useState, useEffect } from 'react';
import type { ServerSyncConfig } from '../../../../shared/sync/types';
import type { AuthState, UserInfo } from '../../../../shared/sync/auth-types';
import { authService } from '../../../../shared/sync/auth-service';
import { AuthModal, UserProfile } from '../auth';

interface ServerConfigProps {
  config: ServerSyncConfig | undefined;
  onChange: (config: ServerSyncConfig) => void;
  onTest: () => Promise<{ success: boolean; error?: string }>;
}

const ServerConfig: React.FC<ServerConfigProps> = ({ config, onChange, onTest }) => {
  const [url, setUrl] = useState(config?.url || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authState, setAuthState] = useState<AuthState>(authService.getState());
  const [loggingOut, setLoggingOut] = useState(false);

  // 监听认证状态变化
  useEffect(() => {
    const unsubscribe = authService.addListener(setAuthState);
    return unsubscribe;
  }, []);

  // URL 变化时配置 AuthService
  useEffect(() => {
    if (url) {
      authService.configure(url, authState.user?.id || 'unknown');
    }
  }, [url]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    onChange({ url: newUrl });
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!authState.isAuthenticated) {
      setTestResult({ success: false, error: '请先登录' });
      return;
    }

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

  const handleLogin = async (email: string, password: string) => {
    // 确保 URL 已配置
    if (!url) {
      return { success: false, error: '请先输入服务器地址' };
    }
    authService.configure(url, 'device-' + Date.now());

    const result = await authService.login({ email, password });
    if (result.success) {
      setShowAuthModal(false);
    }
    return { success: result.success, error: result.message };
  };

  const handleRegister = async (email: string, username: string, password: string) => {
    // 确保 URL 已配置
    if (!url) {
      return { success: false, error: '请先输入服务器地址' };
    }
    authService.configure(url, 'device-' + Date.now());

    const result = await authService.register({ email, username, password });
    if (result.success) {
      setShowAuthModal(false);
    }
    return { success: result.success, error: result.message };
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authService.logout();
    } finally {
      setLoggingOut(false);
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

      {/* 认证状态 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          账户
        </label>
        {authState.isAuthenticated && authState.user ? (
          <UserProfile
            user={authState.user}
            onLogout={handleLogout}
            loading={loggingOut}
          />
        ) : (
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              登录后即可同步您的 API Key 配置
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              disabled={!url}
              className="btn btn-primary"
            >
              登录 / 注册
            </button>
            {!url && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                请先输入服务器地址
              </p>
            )}
          </div>
        )}
      </div>

      {/* 测试连接 */}
      {authState.isAuthenticated && (
        <div className="flex items-center space-x-3">
          <button
            onClick={handleTest}
            disabled={!url || testing}
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
      )}

      {/* 认证弹窗 */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    </div>
  );
};

export default ServerConfig;
