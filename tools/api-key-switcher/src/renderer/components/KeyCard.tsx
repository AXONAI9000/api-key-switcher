import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ApiKey } from '../../shared/types';

interface KeyCardProps {
  apiKey: ApiKey;
  isCurrent: boolean;
  onSwitch: () => void;
  onToggle: () => void;
  onRemove: () => void;
  isSwitching?: boolean;
  isToggling?: boolean;
  isRemoving?: boolean;
}

// 遮蔽 Key 显示
function maskKey(key: string): string {
  if (key.length <= 8) {
    return '****';
  }
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

// Loading spinner component
const Spinner: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const KeyCard: React.FC<KeyCardProps> = ({
  apiKey,
  isCurrent,
  onSwitch,
  onToggle,
  onRemove,
  isSwitching = false,
  isToggling = false,
  isRemoving = false,
}) => {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const { alias, key, enabled, createdAt } = apiKey;
  const isLoading = isSwitching || isToggling || isRemoving;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: alias });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 rounded-lg border-2 transition-all duration-200 ${
        isCurrent
          ? 'border-green-400 bg-green-50 dark:bg-green-900/20 dark:border-green-600'
          : enabled
          ? 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-500'
          : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-60'
      } ${isDragging ? 'shadow-lg z-50' : ''} ${isLoading ? 'pointer-events-none' : ''}`}
    >
      <div className="flex items-center justify-between">
        {/* 拖拽手柄 */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 -ml-2 mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="拖拽排序"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="font-medium text-slate-800 dark:text-slate-100 truncate">{alias}</h3>
            {isCurrent && (
              <span className="badge badge-success">当前</span>
            )}
            {!enabled && (
              <span className="badge badge-warning">已禁用</span>
            )}
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <code className="key-text truncate max-w-xs">
              {showKey ? key : maskKey(key)}
            </code>
            <button
              onClick={() => setShowKey(!showKey)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={showKey ? '隐藏 Key' : '显示 Key'}
            >
              {showKey ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
            <button
              onClick={handleCopy}
              className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md transition-colors ${
                copied
                  ? 'text-green-500 bg-green-50 dark:bg-green-900/30'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title={copied ? '已复制' : '复制 Key'}
            >
              {copied ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            添加于: {new Date(createdAt).toLocaleDateString('zh-CN')}
          </p>
        </div>

        <div className="flex items-center space-x-2 ml-4">
          {!isCurrent && enabled && (
            <button
              onClick={onSwitch}
              disabled={isLoading}
              className="btn btn-primary py-1.5 px-3 text-sm min-w-[60px] flex items-center justify-center"
              title="切换到此 Key"
            >
              {isSwitching ? <Spinner /> : '使用'}
            </button>
          )}

          <button
            onClick={onToggle}
            disabled={isLoading}
            className={`btn py-1.5 px-3 text-sm min-w-[60px] flex items-center justify-center ${
              enabled ? 'btn-secondary' : 'btn-ghost'
            }`}
            title={enabled ? '禁用' : '启用'}
          >
            {isToggling ? <Spinner /> : (enabled ? '禁用' : '启用')}
          </button>

          <button
            onClick={onRemove}
            disabled={isLoading}
            className="btn btn-ghost text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 py-1.5 px-3 text-sm min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="删除"
          >
            {isRemoving ? (
              <Spinner />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeyCard;
