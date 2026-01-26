import React from 'react';
import { useTheme } from './ThemeContext';
import { useSyncContext, SyncStatusBar } from './sync';

interface HeaderProps {
  onExport: () => void;
  onImport: () => void;
  onMinimize: () => void;
  onSyncClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onExport, onImport, onMinimize, onSyncClick }) => {
  const { theme, toggleTheme } = useTheme();
  const { status, lastSyncTime, error, pendingConflict, syncConfig } = useSyncContext();

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-200">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">API Key Switcher</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">管理和切换您的 AI 服务商 API Key</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* 同步状态指示器 */}
          {syncConfig?.enabled && (
            <SyncStatusBar
              status={status}
              lastSyncTime={lastSyncTime}
              error={error}
              hasConflict={pendingConflict !== null}
              onClick={onSyncClick}
            />
          )}

          {/* 同步设置按钮（未启用时显示） */}
          {!syncConfig?.enabled && (
            <button
              onClick={onSyncClick}
              className="btn btn-ghost flex items-center space-x-1"
              title="同步设置"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              <span>同步</span>
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="btn btn-ghost flex items-center space-x-1"
            title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>

          <button
            onClick={onImport}
            className="btn btn-ghost flex items-center space-x-1"
            title="导入配置"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            <span>导入</span>
          </button>

          <button
            onClick={onExport}
            className="btn btn-ghost flex items-center space-x-1"
            title="导出配置"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span>导出</span>
          </button>

          <button
            onClick={onMinimize}
            className="btn btn-ghost flex items-center space-x-1"
            title="最小化到托盘"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 12H4"
              />
            </svg>
            <span>最小化</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
