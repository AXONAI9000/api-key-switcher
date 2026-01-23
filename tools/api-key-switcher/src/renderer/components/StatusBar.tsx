import React from 'react';
import { ProviderConfig, ProviderInfo, ActualEnvStatus } from '../../shared/types';

interface StatusBarProps {
  providerConfig: ProviderConfig | null;
  providerInfo: ProviderInfo | null;
  actualEnvStatus: ActualEnvStatus | null;
}

// 服务商对应的 BASE_URL 环境变量名
const BASE_URL_ENV_MAP: Record<string, string> = {
  claude: 'ANTHROPIC_BASE_URL',
  openai: 'OPENAI_BASE_URL',
  gemini: 'GOOGLE_API_BASE_URL',
  deepseek: 'DEEPSEEK_BASE_URL',
  custom: 'CUSTOM_BASE_URL',
};

const StatusBar: React.FC<StatusBarProps> = ({ providerConfig, providerInfo, actualEnvStatus }) => {
  if (!providerConfig || !providerInfo) {
    return null;
  }

  const { keys, envVar } = providerConfig;

  // 根据实际环境变量状态判断当前使用的 key
  const actualCurrentKey = actualEnvStatus?.matchedAlias || null;
  const isManuallyModified = actualEnvStatus?.isManuallyModified || false;
  const actualEnvValue = actualEnvStatus?.envValue || null;

  // 找到当前使用的 key 配置
  const activeKey = actualCurrentKey ? keys.find(k => k.alias === actualCurrentKey) : null;

  // 获取 Base URL
  const baseUrlEnvName = BASE_URL_ENV_MAP[providerInfo.id] || '';
  const baseUrl = activeKey?.extraEnvVars?.[baseUrlEnvName] || '';

  // 遮蔽 API Key，只显示前8位和后4位
  const maskApiKey = (key: string): string => {
    if (!key) return '';
    if (key.length <= 12) return key.substring(0, 4) + '****';
    return key.substring(0, 8) + '****' + key.substring(key.length - 4);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-800 text-white px-4 py-2 shadow-lg border-t border-slate-700">
      <div className="container mx-auto flex items-center justify-between text-sm">
        {/* 左侧：服务商和当前 Key */}
        <div className="flex items-center space-x-4">
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

        {/* 右侧：环境变量值 */}
        <div className="flex items-center space-x-4">
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
                    <code className="font-mono text-xs bg-slate-700 px-2 py-0.5 rounded text-blue-300 max-w-xs truncate">
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
      </div>
    </div>
  );
};

export default StatusBar;
