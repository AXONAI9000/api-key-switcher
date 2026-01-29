/**
 * 认证相关类型定义
 */

// 用户信息
export interface UserInfo {
  id: string;
  email: string;
  username: string;
  createdAt: string;
}

// 认证状态
export interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null; // Unix timestamp
}

// 登录请求
export interface LoginRequest {
  email: string;
  password: string;
  deviceId?: string;
  deviceName?: string;
}

// 注册请求
export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  deviceId?: string;
  deviceName?: string;
}

// 令牌响应
export interface TokenResponse {
  success: boolean;
  message?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: UserInfo;
}

// 操作响应
export interface OperationResponse {
  success: boolean;
  message?: string;
}

// 修改密码请求
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// 认证错误类型
export type AuthErrorType =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_EXISTS'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

// 认证错误
export class AuthError extends Error {
  constructor(
    public type: AuthErrorType,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// 默认认证状态
export const DEFAULT_AUTH_STATE: AuthState = {
  isAuthenticated: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
};
