import React, { useRef, useEffect, useState } from 'react';
import { ProviderConfig, ProviderInfo, ActualEnvStatus, BASE_URL_ENV_MAP, ProviderType } from '../../shared/types';

interface StatusBarProps {
  providerConfig: ProviderConfig | null;
  providerInfo: ProviderInfo | null;
  actualEnvStatus: ActualEnvStatus | null;
}

// 状态栏内容组件
const StatusContent: React.FC<{
  providerInfo: ProviderInfo;
  isManuallyModified: boolean;
  activeKey: { alias: string; key: string; extraEnvVars?: Record<string, string> } | null;
  actualEnvValue: string | null;
  envVar: string;
  baseUrlEnvName: string;
  baseUrl: string;
  maskApiKey: (key: string) => string;
}> = ({ providerInfo, isManuallyModified, activeKey, actualEnvValue, envVar, baseUrlEnvName, baseUrl, maskApiKey }) => (
  <>
    {/* 服务商和当前 Key */}
    <div className="flex items-center space-x-4 flex-shrink-0">
      <div className="flex items-center space-x-2">
        <span className="text-slate-400">服务商:</span>
        <span className="font-medium text-blue-400">{providerInfo.name}</span>
      </div>

      {isManuallyModified ? (
        <>
          <div className="w-px h-4 bg-slate-600" />
          <span className="text-yellow-400">环境变量已被手动修改</span>
        </>
      ) : activeKey ? (
        <>
          <div className="w-px h-4 bg-slate-600" />
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">当前 Key:</span>
            <span className="font-medium text-green-400">{activeKey.alias}</span>
          </div>
        </>
      ) : (
        <>
          <div className="w-px h-4 bg-slate-600" />
          <span className="text-yellow-400">未选择 Key</span>
        </>
      )}
    </div>

    {/* 分隔符 */}
    <div className="w-px h-4 bg-slate-600 mx-4 flex-shrink-0" />

    {/* 环境变量值 */}
    <div className="flex items-center space-x-4 flex-shrink-0">
      {isManuallyModified && actualEnvValue && (
        <div className="flex items-center space-x-2">
          <code className="text-slate-400 text-xs">{envVar}:</code>
          <code className="font-mono text-xs bg-yellow-700 px-2 py-0.5 rounded text-yellow-200">
            {maskApiKey(actualEnvValue)}
          </code>
        </div>
      )}

      {!isManuallyModified && activeKey && (
        <>
          <div className="flex items-center space-x-2">
            <code className="text-slate-400 text-xs">{envVar}:</code>
            <code className="font-mono text-xs bg-slate-700 px-2 py-0.5 rounded text-green-300">
              {maskApiKey(activeKey.key)}
            </code>
          </div>

          {baseUrl && (
            <>
              <div className="w-px h-4 bg-slate-600" />
              <div className="flex items-center space-x-2">
                <code className="text-slate-400 text-xs">{baseUrlEnvName}:</code>
                <code className="font-mono text-xs bg-slate-700 px-2 py-0.5 rounded text-blue-300">
                  {baseUrl}
                </code>
              </div>
            </>
          )}
        </>
      )}

      {!isManuallyModified && !activeKey && (
        <span className="text-slate-500 text-xs">请选择一个 Key 以查看环境变量</span>
      )}
    </div>
  </>
);

const StatusBar: React.FC<StatusBarProps> = ({ providerConfig, providerInfo, actualEnvStatus }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [needsScroll, setNeedsScroll] = useState(false);

  // 检测是否需要滚动
  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && contentRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const contentWidth = contentRef.current.scrollWidth;
        // 滚动时内容会复制一份，所以需要除以2来判断
        const actualContentWidth = needsScroll ? contentWidth / 2 : contentWidth;
        setNeedsScroll(actualContentWidth > containerWidth);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [providerConfig, providerInfo, actualEnvStatus, needsScroll]);

  if (!providerConfig || !providerInfo) {
    return null;
  }

  const { keys, envVar } = providerConfig;

  // 根据实际环境变量状态判断当前使用的 key
  const actualCurrentKey = actualEnvStatus?.matchedAlias || null;
  const isManuallyModified = actualEnvStatus?.isManuallyModified || false;
  const actualEnvValue = actualEnvStatus?.envValue || null;

  // 找到当前使用的 key 配置
  const activeKey = actualCurrentKey ? keys.find(k => k.alias === actualCurrentKey) ?? null : null;

  // 获取 Base URL
  const baseUrlEnvName = BASE_URL_ENV_MAP[providerInfo.id] || '';
  const baseUrl = activeKey?.extraEnvVars?.[baseUrlEnvName] || '';

  // 遮蔽 API Key，只显示前8位和后4位
  const maskApiKey = (key: string): string => {
    if (!key) return '';
    if (key.length <= 12) return key.substring(0, 4) + '****';
    return key.substring(0, 8) + '****' + key.substring(key.length - 4);
  };

  const contentProps = {
    providerInfo,
    isManuallyModified,
    activeKey,
    actualEnvValue,
    envVar,
    baseUrlEnvName,
    baseUrl,
    maskApiKey,
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-800 dark:bg-slate-900 text-white px-4 py-2 shadow-lg border-t border-slate-700 dark:border-slate-800 overflow-hidden transition-colors duration-200">
      <div ref={containerRef} className="container mx-auto overflow-hidden">
        <div
          ref={contentRef}
          className={`flex items-center text-sm whitespace-nowrap ${needsScroll ? 'animate-marquee' : 'justify-between'}`}
        >
          <StatusContent {...contentProps} />
          {/* 滚动时复制一份内容实现无缝循环 */}
          {needsScroll && (
            <>
              <div className="w-16 flex-shrink-0" />
              <StatusContent {...contentProps} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
