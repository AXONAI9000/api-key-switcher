import type { ProviderType, KeyUsageStats } from './types';
import { getConfigCache } from './config-cache';
import { Logger } from './logger';

const logger = new Logger('UsageTracker');

const EXPIRY_SOON_DAYS = 7;

export function recordSwitch(provider: ProviderType, alias: string): void {
  try {
    const cache = getConfigCache();
    const config = cache.get();
    const providerConfig = config.providers[provider];
    if (!providerConfig) return;

    const key = providerConfig.keys.find(k => k.alias === alias);
    if (!key) return;

    key.switchCount = (key.switchCount || 0) + 1;
    key.lastUsedAt = new Date().toISOString();

    cache.set(config);
  } catch (error) {
    logger.error('Failed to record switch', error);
  }
}

export function getStats(provider: ProviderType): KeyUsageStats[] {
  const cache = getConfigCache();
  const config = cache.get();
  const providerConfig = config.providers[provider];
  if (!providerConfig) return [];

  const now = Date.now();

  return providerConfig.keys.map(key => {
    const expiresAt = key.expiresAt || null;
    const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : null;
    const isExpired = expiresAtMs !== null && expiresAtMs < now;
    const isExpiringSoon = expiresAtMs !== null && !isExpired && (expiresAtMs - now) < EXPIRY_SOON_DAYS * 24 * 60 * 60 * 1000;

    return {
      alias: key.alias,
      provider,
      switchCount: key.switchCount || 0,
      lastUsedAt: key.lastUsedAt || null,
      totalUsageMs: key.totalUsageMs || 0,
      expiresAt,
      isExpired,
      isExpiringSoon,
    };
  });
}

export function getAllStats(): KeyUsageStats[] {
  const providers: ProviderType[] = ['claude', 'openai', 'gemini', 'deepseek', 'custom'];
  return providers.flatMap(p => getStats(p));
}

export function getExpiringKeys(daysThreshold: number = EXPIRY_SOON_DAYS): KeyUsageStats[] {
  const all = getAllStats();
  return all.filter(s => s.isExpiringSoon);
}

export function getExpiredKeys(): KeyUsageStats[] {
  const all = getAllStats();
  return all.filter(s => s.isExpired);
}

export function setExpiry(provider: ProviderType, alias: string, expiresAt: string): void {
  const cache = getConfigCache();
  const config = cache.get();
  const key = config.providers[provider]?.keys.find(k => k.alias === alias);
  if (!key) return;
  key.expiresAt = expiresAt;
  cache.set(config);
}

export function clearExpiry(provider: ProviderType, alias: string): void {
  const cache = getConfigCache();
  const config = cache.get();
  const key = config.providers[provider]?.keys.find(k => k.alias === alias);
  if (!key) return;
  delete key.expiresAt;
  cache.set(config);
}
