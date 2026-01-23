import React from 'react';

interface HeaderProps {
  onExport: () => void;
  onImport: () => void;
  onMinimize: () => void;
}

const Header: React.FC<HeaderProps> = ({ onExport, onImport, onMinimize }) => {
  return (
    <header className="bg-white border-b border-slate-200 shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">API Key Switcher</h1>
            <p className="text-sm text-slate-500">管理和切换您的 AI 服务商 API Key</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onImport}
            className="btn btn-ghost flex items-center space-x-1"
            title="导入配置"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            <span>导入</span>
          </button>

          <button
            onClick={onExport}
            className="btn btn-ghost flex items-center space-x-1"
            title="导出配置"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span>导出</span>
          </button>

          <button
            onClick={onMinimize}
            className="btn btn-ghost flex items-center space-x-1"
            title="最小化到托盘"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 12H4"
              />
            </svg>
            <span>最小化</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
