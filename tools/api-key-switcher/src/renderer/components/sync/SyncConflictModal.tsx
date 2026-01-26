/**
 * 同步冲突解决弹窗
 */

import React, { useState } from 'react';
import type { ConflictData, ConflictResolution } from '../../../shared/sync/types';

interface SyncConflictModalProps {
  isOpen: boolean;
  conflictData: ConflictData;
  onResolve: (resolution: ConflictResolution) => Promise<boolean>;
  onClose: () => void;
}

const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  isOpen,
  conflictData,
  onResolve,
  onClose,
}) => {
  const [loading, setLoading] = useState<ConflictResolution | null>(null);

  const handleResolve = async (resolution: ConflictResolution) => {
    setLoading(resolution);
    try {
      const success = await onResolve(resolution);
      if (success) {
        onClose();
      }
    } finally {
      setLoading(null);
    }
  };

  const formatTime = (isoTime: string): string => {
    return new Date(isoTime).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
              检测到同步冲突
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              本地配置和服务器配置存在差异
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* 本地版本 */}
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="font-medium text-slate-700 dark:text-slate-300">本地版本</span>
            </div>
            <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <p>时间: {formatTime(conflictData.localVersion.timestamp)}</p>
              <p>Key 数量: {conflictData.localVersion.keyCount}</p>
            </div>
          </div>

          {/* 服务器版本 */}
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
              <span className="font-medium text-slate-700 dark:text-slate-300">服务器版本</span>
            </div>
            <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <p>时间: {formatTime(conflictData.remoteVersion.timestamp)}</p>
              <p>Key 数量: {conflictData.remoteVersion.keyCount}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleResolve('local')}
            disabled={loading !== null}
            className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600
              hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors
              flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <div className="text-left">
                <p className="font-medium text-slate-700 dark:text-slate-300">使用本地版本</p>
                <p className="text-xs text-slate-500">覆盖服务器上的配置</p>
              </div>
            </div>
            {loading === 'local' && (
              <svg className="w-5 h-5 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => handleResolve('remote')}
            disabled={loading !== null}
            className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600
              hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors
              flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <div className="text-left">
                <p className="font-medium text-slate-700 dark:text-slate-300">使用服务器版本</p>
                <p className="text-xs text-slate-500">覆盖本地配置</p>
              </div>
            </div>
            {loading === 'remote' && (
              <svg className="w-5 h-5 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => handleResolve('merge')}
            disabled={loading !== null}
            className="w-full p-3 rounded-lg border-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20
              hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors
              flex items-center justify-between"
          >
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <div className="text-left">
                <p className="font-medium text-primary-700 dark:text-primary-300">智能合并（推荐）</p>
                <p className="text-xs text-primary-600 dark:text-primary-400">合并两边的 Key，保留最新的</p>
              </div>
            </div>
            {loading === 'merge' && (
              <svg className="w-5 h-5 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </button>
        </div>

        <button
          onClick={onClose}
          disabled={loading !== null}
          className="mt-4 w-full btn btn-ghost"
        >
          稍后处理
        </button>
      </div>
    </div>
  );
};

export default SyncConflictModal;
