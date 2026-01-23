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
}

// 遮蔽 Key 显示
function maskKey(key: string): string {
  if (key.length <= 8) {
    return '****';
  }
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

const KeyCard: React.FC<KeyCardProps> = ({
  apiKey,
  isCurrent,
  onSwitch,
  onToggle,
  onRemove,
}) => {
  const [showKey, setShowKey] = useState(false);

  const { alias, key, enabled, createdAt } = apiKey;

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 rounded-lg border-2 transition-all duration-200 ${
        isCurrent
          ? 'border-green-400 bg-green-50'
          : enabled
          ? 'border-slate-200 bg-white hover:border-slate-300'
          : 'border-slate-100 bg-slate-50 opacity-60'
      } ${isDragging ? 'shadow-lg z-50' : ''}`}
    >
      <div className="flex items-center justify-between">
        {/* 拖拽手柄 */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 -ml-2 mr-2 text-slate-400 hover:text-slate-600"
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
            <h3 className="font-medium text-slate-800 truncate">{alias}</h3>
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
              className="text-slate-400 hover:text-slate-600 p-1"
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
              onClick={() => navigator.clipboard.writeText(key)}
              className="text-slate-400 hover:text-slate-600 p-1"
              title="复制 Key"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            添加于: {new Date(createdAt).toLocaleDateString('zh-CN')}
          </p>
        </div>

        <div className="flex items-center space-x-2 ml-4">
          {!isCurrent && enabled && (
            <button
              onClick={onSwitch}
              className="btn btn-primary py-1.5 px-3 text-sm"
              title="切换到此 Key"
            >
              使用
            </button>
          )}

          <button
            onClick={onToggle}
            className={`btn py-1.5 px-3 text-sm ${
              enabled ? 'btn-secondary' : 'btn-ghost'
            }`}
            title={enabled ? '禁用' : '启用'}
          >
            {enabled ? '禁用' : '启用'}
          </button>

          <button
            onClick={onRemove}
            className="btn btn-ghost text-red-500 hover:bg-red-50 py-1.5 px-3 text-sm"
            title="删除"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeyCard;
