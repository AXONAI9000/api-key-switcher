import React, { useState, useEffect, useRef } from 'react';
import { ProviderType, ProviderInfo, BASE_URL_ENV_MAP } from '../../shared/types';

interface AddKeyModalProps {
  provider: ProviderType;
  providerInfo: ProviderInfo;
  onClose: () => void;
  onAdd: (key: string, alias: string, baseUrl?: string) => void;
  isLoading?: boolean;
}

// Loading spinner component
const Spinner: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const AddKeyModal: React.FC<AddKeyModalProps> = ({
  provider,
  providerInfo,
  onClose,
  onAdd,
  isLoading = false,
}) => {
  const [key, setKey] = useState('');
  const [alias, setAlias] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

  // Focus the key input on mount
  useEffect(() => {
    keyInputRef.current?.focus();
  }, []);

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isLoading]);

  // Focus trap
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedKey = key.trim();
    if (!trimmedKey) {
      setError('请输入 API Key');
      keyInputRef.current?.focus();
      return;
    }

    if (trimmedKey.length < 10) {
      setError('API Key 长度不正确');
      keyInputRef.current?.focus();
      return;
    }

    onAdd(trimmedKey, alias.trim() || undefined!, baseUrl.trim() || undefined);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const baseUrlEnvName = BASE_URL_ENV_MAP[provider];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            添加 {providerInfo.name} Key
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
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
              <label htmlFor="api-key" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                API Key <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  ref={keyInputRef}
                  id="api-key"
                  type={showKey ? 'text' : 'password'}
                  value={key}
                  onChange={(e) => {
                    setKey(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="输入你的 API Key"
                  className={`input pr-10 ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
                  disabled={isLoading}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'key-error' : 'key-hint'}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center"
                  tabIndex={-1}
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
              {error ? (
                <p id="key-error" className="text-xs text-red-500 mt-1" role="alert">
                  {error}
                </p>
              ) : (
                <p id="key-hint" className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Key 将存储在本地配置文件中
                </p>
              )}
            </div>

            {/* Base URL 输入 */}
            <div>
              <label htmlFor="base-url" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                API Base URL (可选)
              </label>
              <input
                id="base-url"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="例如: https://api.example.com"
                className="input"
                disabled={isLoading}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                用于代理服务，留空则使用官方默认地址
              </p>
            </div>

            {/* 别名输入 */}
            <div>
              <label htmlFor="alias" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                别名 (可选)
              </label>
              <input
                id="alias"
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="例如: 主账号、代理服务"
                className="input"
                disabled={isLoading}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                用于标识和区分不同的 Key，留空将自动生成
              </p>
            </div>
          </div>

          {/* 提示信息 */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p>切换时将自动设置环境变量:</p>
                <code className="font-mono text-xs bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded block mt-1">
                  {providerInfo.envVar}
                </code>
                {baseUrl && baseUrlEnvName && (
                  <code className="font-mono text-xs bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded block mt-1">
                    {baseUrlEnvName}
                  </code>
                )}
              </div>
            </div>
          </div>

          {/* 按钮 */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary min-w-[80px] flex items-center justify-center"
            >
              {isLoading ? <Spinner /> : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddKeyModal;
