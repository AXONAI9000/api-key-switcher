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
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const { alias, key, enabled, createdAt, extraEnvVars } = apiKey;
  const isLoading = isSwitching || isToggling || isRemoving;
  const baseUrl = extraEnvVars ? Object.values(extraEnvVars)[0] : null;

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
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyUrl = async () => {
    if (!baseUrl) return;
    try {
      await navigator.clipboard.writeText(baseUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border transition-all duration-200 ${
        isDragging ? 'shadow-xl z-50 opacity-90' : 'shadow-sm'
      } ${isLoading ? 'pointer-events-none' : ''} ${
        isCurrent
          ? 'border-green-500/50 bg-gradient-to-r from-green-50 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/10 dark:border-green-500/30'
          : enabled
          ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md'
          : 'border-slate-200/50 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-800/40'
      }`}
    >
      {/* 当前使用指示条 */}
      {isCurrent && (
        <div className="absolute left-0 top-3 bottom-3 w-1 bg-green-500 rounded-r-full" />
      )}

      <div className="p-4 pl-5">
        <div className="flex items-start gap-3">
          {/* 拖拽手柄 */}
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1.5 -ml-1 mt-0.5 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 rounded transition-colors"
            title="拖拽排序"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="6" r="1.5" />
              <circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" />
              <circle cx="15" cy="18" r="1.5" />
            </svg>
          </div>

          {/* 主要内容区 */}
          <div className="flex-1 min-w-0">
            {/* 标题行 */}
            <div className="flex items-center gap-2 mb-2">
              <h3 className={`font-semibold truncate ${
                enabled ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
              }`}>
                {alias}
              </h3>
              {isCurrent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  当前
                </span>
              )}
              {!enabled && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                  已禁用
                </span>
              )}
            </div>

            {/* Key 显示区 */}
            <div className="flex items-center gap-1.5 mb-2">
              <code className={`font-mono text-sm px-2 py-1 rounded-md truncate max-w-[200px] ${
                enabled
                  ? 'bg-slate-100 text-slate-600 dark:bg-slate-700/70 dark:text-slate-300'
                  : 'bg-slate-100/50 text-slate-400 dark:bg-slate-700/30 dark:text-slate-500'
              }`}>
                {showKey ? key : maskKey(key)}
              </code>
              <button
                onClick={() => setShowKey(!showKey)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title={showKey ? '隐藏 Key' : '显示 Key'}
              >
                {showKey ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleCopyKey}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  copiedKey
                    ? 'text-green-500 bg-green-50 dark:bg-green-900/30'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title={copiedKey ? '已复制' : '复制 Key'}
              >
                {copiedKey ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>

            {/* URL 和元信息 */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
              {baseUrl && (
                <div className="inline-flex items-center gap-0.5">
                  <code
                    className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-l bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 font-mono truncate max-w-[240px]"
                    title={baseUrl}
                  >
                    <svg className="w-3 h-3 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span className="truncate">{baseUrl}</span>
                  </code>
                  <button
                    onClick={handleCopyUrl}
                    className={`p-1 rounded-r transition-colors cursor-pointer ${
                      copiedUrl
                        ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400'
                        : 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/50'
                    }`}
                    title={copiedUrl ? '已复制' : '复制 URL'}
                  >
                    {copiedUrl ? (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
              <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {new Date(createdAt).toLocaleDateString('zh-CN')}
              </span>
            </div>
          </div>

          {/* 操作按钮区 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isCurrent && enabled && (
              <button
                onClick={onSwitch}
                disabled={isLoading}
                className="btn btn-primary py-1.5 px-3 text-sm min-w-[60px] min-h-[36px] flex items-center justify-center cursor-pointer"
                title="切换到此 Key"
              >
                {isSwitching ? <Spinner /> : '使用'}
              </button>
            )}

            <button
              onClick={onToggle}
              disabled={isLoading}
              className={`btn py-1.5 px-3 text-sm min-w-[60px] min-h-[36px] flex items-center justify-center cursor-pointer ${
                enabled ? 'btn-secondary' : 'btn-ghost'
              }`}
              title={enabled ? '禁用' : '启用'}
            >
              {isToggling ? <Spinner /> : (enabled ? '禁用' : '启用')}
            </button>

            <button
              onClick={onRemove}
              disabled={isLoading}
              className="btn btn-ghost text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
              title="删除"
            >
              {isRemoving ? (
                <Spinner />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyCard;
