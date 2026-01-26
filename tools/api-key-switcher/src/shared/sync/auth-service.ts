/**
 * 认证服务
 */

import type {
  AuthState,
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UserInfo,
  ChangePasswordRequest,
  OperationResponse,
} from './auth-types';
import { AuthError, DEFAULT_AUTH_STATE } from './auth-types';

// 存储键
const AUTH_STORAGE_KEY = 'api-key-switcher-auth';

// 请求超时
const REQUEST_TIMEOUT = 30000;

// Token 刷新提前量（秒）
const TOKEN_REFRESH_THRESHOLD = 60;

/**
 * 认证服务类
 */
export class AuthService {
  private static instance: AuthService;
  private state: AuthState = DEFAULT_AUTH_STATE;
  private baseUrl: string = '';
  private deviceId: string = '';
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<(state: AuthState) => void> = new Set();

  private constructor() {
    this.loadState();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * 配置服务
   */
  configure(baseUrl: string, deviceId: string): void {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.deviceId = deviceId;
  }

  /**
   * 获取当前状态
   */
  getState(): AuthState {
    return { ...this.state };
  }

  /**
   * 是否已认证
   */
  isAuthenticated(): boolean {
    return this.state.isAuthenticated && !!this.state.accessToken;
  }

  /**
   * 获取访问令牌（自动刷新）
   */
  async getAccessToken(): Promise<string | null> {
    if (!this.state.accessToken) {
      return null;
    }

    // 检查是否需要刷新
    if (this.shouldRefreshToken()) {
      try {
        await this.refreshAccessToken();
      } catch {
        // 刷新失败，返回当前 token（可能已过期）
      }
    }

    return this.state.accessToken;
  }

  /**
   * 添加状态监听器
   */
  addListener(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 注册
   */
  async register(request: RegisterRequest): Promise<TokenResponse> {
    const response = await this.request<TokenResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...request,
        deviceId: this.deviceId,
        deviceName: this.getDeviceName(),
      }),
    });

    if (response.success && response.accessToken && response.refreshToken) {
      this.updateState({
        isAuthenticated: true,
        user: response.user || null,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresAt: this.calculateExpiresAt(response.expiresIn),
      });
      this.scheduleTokenRefresh();
    }

    return response;
  }

  /**
   * 登录
   */
  async login(request: LoginRequest): Promise<TokenResponse> {
    const response = await this.request<TokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        ...request,
        deviceId: this.deviceId,
        deviceName: this.getDeviceName(),
      }),
    });

    if (response.success && response.accessToken && response.refreshToken) {
      this.updateState({
        isAuthenticated: true,
        user: response.user || null,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresAt: this.calculateExpiresAt(response.expiresIn),
      });
      this.scheduleTokenRefresh();
    }

    return response;
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    if (this.state.refreshToken) {
      try {
        await this.request('/api/v1/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: this.state.refreshToken }),
          headers: {
            'Authorization': `Bearer ${this.state.accessToken}`,
          },
        });
      } catch {
        // 忽略登出错误
      }
    }

    this.clearState();
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(): Promise<TokenResponse> {
    if (!this.state.refreshToken) {
      throw new AuthError('TOKEN_INVALID', '没有刷新令牌');
    }

    const response = await this.request<TokenResponse>('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.state.refreshToken }),
    });

    if (response.success && response.accessToken && response.refreshToken) {
      this.updateState({
        ...this.state,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresAt: this.calculateExpiresAt(response.expiresIn),
        user: response.user || this.state.user,
      });
      this.scheduleTokenRefresh();
    } else {
      // 刷新失败，清除状态
      this.clearState();
      throw new AuthError('TOKEN_EXPIRED', response.message || '令牌刷新失败');
    }

    return response;
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<UserInfo | null> {
    if (!this.state.accessToken) {
      return null;
    }

    try {
      const response = await this.request<UserInfo>('/api/v1/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.state.accessToken}`,
        },
      });
      return response;
    } catch {
      return null;
    }
  }

  /**
   * 修改密码
   */
  async changePassword(request: ChangePasswordRequest): Promise<OperationResponse> {
    const response = await this.request<OperationResponse>('/api/v1/auth/password', {
      method: 'PUT',
      body: JSON.stringify(request),
      headers: {
        'Authorization': `Bearer ${this.state.accessToken}`,
      },
    });

    if (response.success) {
      // 密码修改成功后需要重新登录
      this.clearState();
    }

    return response;
  }

  /**
   * 发送 HTTP 请求
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': this.deviceId,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new AuthError('TOKEN_INVALID', data.message || '认证失败');
        }
        throw new AuthError('UNKNOWN', data.message || '请求失败');
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AuthError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new AuthError('NETWORK_ERROR', '请求超时');
        }
        throw new AuthError('NETWORK_ERROR', error.message);
      }

      throw new AuthError('UNKNOWN', '未知错误');
    }
  }

  /**
   * 更新状态
   */
  private updateState(newState: AuthState): void {
    this.state = newState;
    this.saveState();
    this.notifyListeners();
  }

  /**
   * 清除状态
   */
  private clearState(): void {
    this.cancelTokenRefresh();
    this.state = DEFAULT_AUTH_STATE;
    this.saveState();
    this.notifyListeners();
  }

  /**
   * 通知监听器
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * 保存状态到存储
   */
  private saveState(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch {
      // 忽略存储错误
    }
  }

  /**
   * 从存储加载状态
   */
  private loadState(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as AuthState;
          // 验证状态有效性
          if (parsed.accessToken && parsed.refreshToken) {
            this.state = parsed;
            // 如果 token 可能过期，安排刷新
            if (this.shouldRefreshToken()) {
              this.scheduleTokenRefresh(0);
            } else {
              this.scheduleTokenRefresh();
            }
          }
        }
      }
    } catch {
      // 忽略加载错误
    }
  }

  /**
   * 计算过期时间
   */
  private calculateExpiresAt(expiresIn?: number): number | null {
    if (!expiresIn) return null;
    return Math.floor(Date.now() / 1000) + expiresIn;
  }

  /**
   * 是否应该刷新 token
   */
  private shouldRefreshToken(): boolean {
    if (!this.state.expiresAt) return false;
    const now = Math.floor(Date.now() / 1000);
    return now >= this.state.expiresAt - TOKEN_REFRESH_THRESHOLD;
  }

  /**
   * 安排 token 刷新
   */
  private scheduleTokenRefresh(delayOverride?: number): void {
    this.cancelTokenRefresh();

    if (!this.state.expiresAt || !this.state.refreshToken) return;

    const now = Math.floor(Date.now() / 1000);
    const delay = delayOverride ?? Math.max(0, (this.state.expiresAt - now - TOKEN_REFRESH_THRESHOLD) * 1000);

    this.refreshTimer = setTimeout(async () => {
      try {
        await this.refreshAccessToken();
      } catch {
        // 刷新失败，状态已清除
      }
    }, delay);
  }

  /**
   * 取消 token 刷新
   */
  private cancelTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * 获取设备名称
   */
  private getDeviceName(): string {
    if (typeof navigator !== 'undefined') {
      return navigator.userAgent.substring(0, 100);
    }
    return 'Unknown Device';
  }
}

// 导出单例
export const authService = AuthService.getInstance();
