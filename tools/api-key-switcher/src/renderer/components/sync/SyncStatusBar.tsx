/**
 * 同步状态指示器组件
 */

import React from 'react';
import type { SyncStatus } from '../../../shared/sync/types';

interface SyncStatusBarProps {
  status: SyncStatus;
  lastSyncTime: string | null;
  error: string | null;
  hasConflict: boolean;
  onClick: () => void;
}

const STATUS_CONFIG: Record<SyncStatus, {
  icon: React.ReactNode;
  label: string;
  colorClass: string;
  animate?: boolean;
}> = {
  idle: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
    label: '同步就绪',
    colorClass: 'text-green-500',
  },
  syncing: {
    icon: (
      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    label: '同步中...',
    colorClass: 'text-blue-500',
    animate: true,
  },
  uploading: {
    icon: (
      <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    label: '上传中...',
    colorClass: 'text-blue-500',
    animate: true,
  },
  downloading: {
    icon: (
      <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
    label: '下载中...',
    colorClass: 'text-blue-500',
    animate: true,
  },
  conflict: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    label: '存在冲突',
    colorClass: 'text-yellow-500',
  },
  error: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: '同步错误',
    colorClass: 'text-red-500',
  },
};

const SyncStatusBar: React.FC<SyncStatusBarProps> = ({
  status,
  lastSyncTime,
  error,
  hasConflict,
  onClick,
}) => {
  const config = STATUS_CONFIG[hasConflict ? 'conflict' : status];

  const formatTime = (isoTime: string): string => {
    const date = new Date(isoTime);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return '刚刚';
    if (diffMinutes < 60) return `${diffMinutes} 分钟前`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} 小时前`;

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-3 py-1.5 rounded-md transition-all duration-200
        hover:bg-slate-100 dark:hover:bg-slate-700 ${config.colorClass}`}
      title={error || (lastSyncTime ? `上次同步: ${formatTime(lastSyncTime)}` : '点击打开同步设置')}
    >
      {config.icon}
      <span className="text-sm font-medium">{config.label}</span>
      {lastSyncTime && status === 'idle' && !hasConflict && (
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {formatTime(lastSyncTime)}
        </span>
      )}
    </button>
  );
};

export default SyncStatusBar;
