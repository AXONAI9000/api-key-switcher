import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ProviderType, ProviderConfig, ProviderInfo, ActualEnvStatus } from '../../shared/types';
import KeyCard from './KeyCard';

interface ProviderPanelProps {
  provider: ProviderType;
  providerConfig: ProviderConfig;
  providerInfo: ProviderInfo;
  actualEnvStatus: ActualEnvStatus | null;
  onAddKey: () => void;
  onRemoveKey: (alias: string) => void;
  onSwitchKey: (alias: string) => void;
  onToggleKey: (alias: string) => void;
  onEditKey: (alias: string) => void;
  onReorderKeys: (aliases: string[]) => void;
  isSwitching: string | null;
  isToggling: string | null;
  isRemoving: string | null;
  onValidateKey?: (alias: string) => void;
  validationStatuses?: Record<string, string>;
  keyStats?: Record<string, any>;
  onUpdateClaude?: () => void;
  isUpdatingClaude?: boolean;
  claudeVersion?: string | null;
}

const ProviderPanel: React.FC<ProviderPanelProps> = ({
  provider,
  providerConfig,
  providerInfo,
  actualEnvStatus,
  onAddKey,
  onRemoveKey,
  onSwitchKey,
  onToggleKey,
  onEditKey,
  onReorderKeys,
  isSwitching,
  isToggling,
  isRemoving,
  onValidateKey,
  validationStatuses,
  keyStats,
  onUpdateClaude,
  isUpdatingClaude,
  claudeVersion,
}) => {
  const { keys, envVar } = providerConfig;

  // 根据实际环境变量状态判断当前使用的 key
  const actualCurrentKey = actualEnvStatus?.matchedAlias || null;
  const isManuallyModified = actualEnvStatus?.isManuallyModified || false;

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 处理拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = keys.findIndex((k) => k.alias === active.id);
      const newIndex = keys.findIndex((k) => k.alias === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newKeys = [...keys];
        const [movedItem] = newKeys.splice(oldIndex, 1);
        newKeys.splice(newIndex, 0, movedItem);
        onReorderKeys(newKeys.map((k) => k.alias));
      }
    }
  };

  return (
    <div className="card">
      {/* 头部信息 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{providerInfo.name}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            环境变量: <code className="key-text">{envVar}</code>
          </p>
        </div>
        <button onClick={onAddKey} className="btn btn-primary flex items-center space-x-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span>添加 Key</span>
        </button>
      </div>

      {/* 环境变量状态提示 */}
      {isManuallyModified && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <div className="flex items-center space-x-2">
            <svg
              className="w-5 h-5 text-yellow-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-yellow-700 dark:text-yellow-300 font-medium">
              环境变量已被手动修改，与配置不匹配
            </span>
          </div>
        </div>
      )}

      {/* 当前使用的 Key */}
      {actualCurrentKey && !isManuallyModified && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
          <div className="flex items-center space-x-2">
            <svg
              className="w-5 h-5 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-green-700 dark:text-green-300 font-medium">当前使用: {actualCurrentKey}</span>
          </div>
        </div>
      )}

      {/* Key 列表 */}
      {keys.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
          <p className="text-slate-600 dark:text-slate-300 font-medium mb-2">还没有添加任何 API Key</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mb-4">添加 API Key 后可以快速切换不同账号或代理服务</p>
          <button onClick={onAddKey} className="btn btn-primary">
            添加第一个 Key
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={keys.map((k) => k.alias)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {keys.map((key) => (
                <KeyCard
                  key={key.alias}
                  apiKey={key}
                  isCurrent={actualCurrentKey === key.alias && !isManuallyModified}
                  onSwitch={() => onSwitchKey(key.alias)}
                  onToggle={() => onToggleKey(key.alias)}
                  onRemove={() => onRemoveKey(key.alias)}
                  onEdit={() => onEditKey(key.alias)}
                  isSwitching={isSwitching === key.alias}
                  isToggling={isToggling === key.alias}
                  isRemoving={isRemoving === key.alias}
                  onValidate={onValidateKey ? () => onValidateKey(key.alias) : undefined}
                  validationStatus={validationStatuses?.[key.alias]}
                  stats={keyStats?.[key.alias]}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Claude Code 更新区块 */}
      {provider === 'claude' && (
        <div className="mt-6 p-4 bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-violet-700 dark:text-violet-300">
                🔄 Claude Code 工具更新
              </h4>
              <p className="text-sm text-violet-600 dark:text-violet-400 mt-1">
                {claudeVersion ? `当前版本: ${claudeVersion}` : '版本获取中...'}
              </p>
            </div>
            <button
              onClick={onUpdateClaude}
              disabled={isUpdatingClaude}
              className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              {isUpdatingClaude && (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isUpdatingClaude ? '更新中...' : '检查更新'}
            </button>
          </div>
        </div>
      )}

      {/* 使用提示 */}
      {keys.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
          <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">自动设置环境变量</h4>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            点击"使用"按钮后，系统环境变量会自动设置。新开的终端窗口将自动使用新的配置。
          </p>
        </div>
      )}
    </div>
  );
};

export default ProviderPanel;
