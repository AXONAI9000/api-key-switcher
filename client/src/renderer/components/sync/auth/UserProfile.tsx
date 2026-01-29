/**
 * 用户信息显示组件
 */

import React from 'react';
import type { UserInfo } from '../../../../shared/sync/auth-types';

interface UserProfileProps {
  user: UserInfo;
  onLogout: () => void;
  loading?: boolean;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onLogout, loading = false }) => {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
          <span className="text-primary-600 dark:text-primary-400 font-medium text-lg">
            {user.username.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <p className="font-medium text-slate-800 dark:text-slate-100">{user.username}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
        </div>
      </div>
      <button
        onClick={onLogout}
        disabled={loading}
        className="btn btn-ghost text-sm flex items-center space-x-1"
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        )}
        <span>登出</span>
      </button>
    </div>
  );
};

export default UserProfile;
