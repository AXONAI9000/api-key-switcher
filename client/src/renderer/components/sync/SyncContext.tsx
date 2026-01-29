/**
 * 同步上下文 - 管理同步状态和操作
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  SyncConfig,
  SyncStatus,
  SyncResult,
  SyncStatusChangeEvent,
  ConflictData,
  ConflictResolution,
} from '../../../shared/sync/types';

interface SyncContextValue {
  // 状态
  syncConfig: SyncConfig | null;
  status: SyncStatus;
  lastSyncTime: string | null;
  error: string | null;
  pendingConflict: ConflictData | null;
  isPasswordVerified: boolean;

  // 操作
  loadSyncConfig: () => Promise<void>;
  saveSyncConfig: (config: Partial<SyncConfig>) => Promise<boolean>;
  testConnection: () => Promise<{ success: boolean; error?: string }>;
  syncPull: () => Promise<SyncResult>;
  syncPush: () => Promise<SyncResult>;
  syncExecute: () => Promise<SyncResult>;
  resolveConflict: (resolution: ConflictResolution) => Promise<boolean>;
  setMasterPassword: (password: string) => Promise<boolean>;
  verifyMasterPassword: (password: string) => Promise<{ valid: boolean; isFirstTime: boolean }>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export const useSyncContext = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncContext must be used within a SyncProvider');
  }
  return context;
};

interface SyncProviderProps {
  children: React.ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(null);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingConflict, setPendingConflict] = useState<ConflictData | null>(null);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);

  const autoSyncTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 加载同步配置
  const loadSyncConfig = useCallback(async () => {
    try {
      const response = await window.electronAPI.syncGetConfig();
      if (response.success && response.data) {
        setSyncConfig(response.data);
        setLastSyncTime(response.data.lastSyncTime || null);
      }
    } catch (err) {
      console.error('Failed to load sync config:', err);
    }
  }, []);

  // 保存同步配置
  const saveSyncConfig = useCallback(async (config: Partial<SyncConfig>): Promise<boolean> => {
    try {
      const response = await window.electronAPI.syncSaveConfig(config);
      if (response.success) {
        await loadSyncConfig();
        return true;
      }
      setError(response.error || 'Failed to save sync config');
      return false;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  }, [loadSyncConfig]);

  // 测试连接
  const testConnection = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await window.electronAPI.syncTestConnection();
      return {
        success: response.success && response.data?.connected === true,
        error: response.error,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, []);

  // 拉取配置
  const syncPull = useCallback(async (): Promise<SyncResult> => {
    try {
      const response = await window.electronAPI.syncPull();
      if (response.success && response.data) {
        if (response.data.conflictData) {
          setPendingConflict(response.data.conflictData);
        }
        if (response.data.syncedAt) {
          setLastSyncTime(response.data.syncedAt);
        }
        return response.data;
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, []);

  // 推送配置
  const syncPush = useCallback(async (): Promise<SyncResult> => {
    try {
      const response = await window.electronAPI.syncPush();
      if (response.success && response.data) {
        if (response.data.syncedAt) {
          setLastSyncTime(response.data.syncedAt);
        }
        return response.data;
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, []);

  // 执行双向同步
  const syncExecute = useCallback(async (): Promise<SyncResult> => {
    try {
      const response = await window.electronAPI.syncExecute();
      if (response.success && response.data) {
        if (response.data.conflictData) {
          setPendingConflict(response.data.conflictData);
        }
        if (response.data.syncedAt) {
          setLastSyncTime(response.data.syncedAt);
        }
        return response.data;
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, []);

  // 解决冲突
  const resolveConflict = useCallback(async (resolution: ConflictResolution): Promise<boolean> => {
    try {
      const response = await window.electronAPI.syncResolveConflict(resolution);
      if (response.success) {
        setPendingConflict(null);
        return true;
      }
      setError(response.error || 'Failed to resolve conflict');
      return false;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  }, []);

  // 设置主密码
  const setMasterPassword = useCallback(async (password: string): Promise<boolean> => {
    try {
      const response = await window.electronAPI.syncSetMasterPassword(password);
      if (response.success) {
        setIsPasswordVerified(true);
        return true;
      }
      setError(response.error || 'Failed to set master password');
      return false;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  }, []);

  // 验证主密码
  const verifyMasterPassword = useCallback(async (
    password: string
  ): Promise<{ valid: boolean; isFirstTime: boolean }> => {
    try {
      const response = await window.electronAPI.syncVerifyMasterPassword(password);
      if (response.success && response.data) {
        if (response.data.valid) {
          setIsPasswordVerified(true);
        }
        return response.data;
      }
      return { valid: false, isFirstTime: false };
    } catch (err) {
      setError((err as Error).message);
      return { valid: false, isFirstTime: false };
    }
  }, []);

  // 监听同步状态变化
  useEffect(() => {
    const unsubscribe = window.electronAPI.onSyncStatusChange((event: SyncStatusChangeEvent) => {
      setStatus(event.status);
      if (event.error) {
        setError(event.error);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 初始加载
  useEffect(() => {
    loadSyncConfig();
  }, [loadSyncConfig]);

  // 自动同步
  useEffect(() => {
    if (autoSyncTimerRef.current) {
      clearInterval(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
    }

    if (syncConfig?.enabled && syncConfig.autoSync && isPasswordVerified) {
      const intervalMs = (syncConfig.autoSyncInterval || 30) * 60 * 1000;
      autoSyncTimerRef.current = setInterval(() => {
        syncExecute();
      }, intervalMs);
    }

    return () => {
      if (autoSyncTimerRef.current) {
        clearInterval(autoSyncTimerRef.current);
      }
    };
  }, [syncConfig?.enabled, syncConfig?.autoSync, syncConfig?.autoSyncInterval, isPasswordVerified, syncExecute]);

  const value: SyncContextValue = {
    syncConfig,
    status,
    lastSyncTime,
    error,
    pendingConflict,
    isPasswordVerified,
    loadSyncConfig,
    saveSyncConfig,
    testConnection,
    syncPull,
    syncPush,
    syncExecute,
    resolveConflict,
    setMasterPassword,
    verifyMasterPassword,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
};

export default SyncContext;
