import React, { useState } from 'react';
import { ProviderType, ProviderInfo } from '../../shared/types';

interface AddKeyModalProps {
  provider: ProviderType;
  providerInfo: ProviderInfo;
  onClose: () => void;
  onAdd: (key: string, alias: string, baseUrl?: string) => void;
}

// 服务商对应的 BASE_URL 环境变量名
const BASE_URL_ENV_MAP: Record<string, string> = {
  claude: 'ANTHROPIC_BASE_URL',
  openai: 'OPENAI_BASE_URL',
  gemini: 'GOOGLE_API_BASE_URL',
  deepseek: 'DEEPSEEK_BASE_URL',
  custom: 'CUSTOM_BASE_URL',
};

const AddKeyModal: React.FC<AddKeyModalProps> = ({
  provider,
  providerInfo,
  onClose,
  onAdd,
}) => {
  const [key, setKey] = useState('');
  const [alias, setAlias] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) {
      alert('请输入 API Key');
      return;
    }
    onAdd(key.trim(), alias.trim() || undefined!, baseUrl.trim() || undefined);
  };

  const baseUrlEnvName = BASE_URL_ENV_MAP[provider];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            添加 {providerInfo.name} Key
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* API Key 输入 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                API Key <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="输入你的 API Key"
                  className="input pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showKey ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Key 将存储在本地配置文件中
              </p>
            </div>

            {/* Base URL 输入 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                API Base URL (可选)
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="例如: https://api.example.com"
                className="input"
              />
              <p className="text-xs text-slate-500 mt-1">
                用于代理服务，留空则使用官方默认地址
              </p>
            </div>

            {/* 别名输入 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                别名 (可选)
              </label>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="例如: 主账号、代理服务"
                className="input"
              />
              <p className="text-xs text-slate-500 mt-1">
                用于标识和区分不同的 Key，留空将自动生成
              </p>
            </div>
          </div>

          {/* 提示信息 */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm text-blue-700">
                <p>切换时将自动设置环境变量:</p>
                <code className="font-mono text-xs bg-blue-100 px-1 py-0.5 rounded block mt-1">
                  {providerInfo.envVar}
                </code>
                {baseUrl && baseUrlEnvName && (
                  <code className="font-mono text-xs bg-blue-100 px-1 py-0.5 rounded block mt-1">
                    {baseUrlEnvName}
                  </code>
                )}
              </div>
            </div>
          </div>

          {/* 按钮 */}
          <div className="flex justify-end space-x-3 mt-6">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              取消
            </button>
            <button type="submit" className="btn btn-primary">
              添加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddKeyModal;
