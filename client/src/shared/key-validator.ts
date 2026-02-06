/**
 * API Key 验证器
 * 通过向各服务商 API 发送轻量请求来验证 Key 的有效性
 */

import { ProviderType } from './types';
import { Logger } from './logger';

const logger = new Logger('KeyValidator');

// Key 状态类型
export type KeyStatus =
  | 'valid'
  | 'invalid'
  | 'expired'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'network_error'
  | 'skipped';

// Key 验证结果
export interface KeyValidationResult {
  valid: boolean;
  status: KeyStatus;
  error?: string;
  provider: ProviderType;
  checkedAt: string;
}

// 验证端点配置
export interface ValidationEndpoint {
  url: string;
  method: string;
  headers: (key: string) => Record<string, string>;
  body?: (key: string) => string;
  parseResponse: (status: number, body: unknown) => KeyValidationResult;
}

/**
 * 根据 HTTP 状态码和响应体构建验证结果的通用辅助函数
 */
function buildResult(
  provider: ProviderType,
  status: number,
  _body: unknown
): KeyValidationResult {
  const checkedAt = new Date().toISOString();

  if (status === 401) {
    return {
      valid: false,
      status: 'invalid',
      error: 'Authentication failed: invalid API key',
      provider,
      checkedAt,
    };
  }

  if (status === 403) {
    return {
      valid: false,
      status: 'invalid',
      error: 'Access forbidden: API key lacks permissions',
      provider,
      checkedAt,
    };
  }

  if (status === 429) {
    return {
      valid: true,
      status: 'rate_limited',
      error: 'API key is rate limited but appears valid',
      provider,
      checkedAt,
    };
  }

  if (status >= 500) {
    return {
      valid: false,
      status: 'network_error',
      error: `Server error: HTTP ${status}`,
      provider,
      checkedAt,
    };
  }

  // 200-499 (excluding 401, 403, 429) are considered valid
  if (status >= 200 && status < 500) {
    return {
      valid: true,
      status: 'valid',
      provider,
      checkedAt,
    };
  }

  return {
    valid: false,
    status: 'network_error',
    error: `Unexpected HTTP status: ${status}`,
    provider,
    checkedAt,
  };
}

/**
 * 获取指定服务商的验证端点配置
 */
export function getValidationEndpoint(
  provider: ProviderType,
  baseUrl?: string
): ValidationEndpoint {
  switch (provider) {
    case 'claude':
      return {
        url: `${baseUrl || 'https://api.anthropic.com'}/v1/messages`,
        method: 'POST',
        headers: (key: string) => ({
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        }),
        body: () =>
          JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        parseResponse: (status: number, body: unknown) =>
          buildResult('claude', status, body),
      };

    case 'openai':
      return {
        url: `${baseUrl || 'https://api.openai.com'}/v1/models`,
        method: 'GET',
        headers: (key: string) => ({
          Authorization: `Bearer ${key}`,
        }),
        parseResponse: (status: number, body: unknown) =>
          buildResult('openai', status, body),
      };

    case 'gemini':
      return {
        url: `${baseUrl || 'https://generativelanguage.googleapis.com'}/v1/models`,
        method: 'GET',
        headers: () => ({}),
        parseResponse: (status: number, body: unknown) =>
          buildResult('gemini', status, body),
      };

    case 'deepseek':
      return {
        url: `${baseUrl || 'https://api.deepseek.com'}/v1/models`,
        method: 'GET',
        headers: (key: string) => ({
          Authorization: `Bearer ${key}`,
        }),
        parseResponse: (status: number, body: unknown) =>
          buildResult('deepseek', status, body),
      };

    case 'custom':
    default:
      return {
        url: '',
        method: 'GET',
        headers: () => ({}),
        parseResponse: () => ({
          valid: true,
          status: 'skipped' as KeyStatus,
          provider: 'custom' as ProviderType,
          checkedAt: new Date().toISOString(),
        }),
      };
  }
}

/**
 * 验证 API Key 的有效性
 * 通过向服务商 API 发送轻量请求来检测 Key 是否可用
 */
export async function validateApiKey(
  provider: ProviderType,
  key: string,
  baseUrl?: string
): Promise<KeyValidationResult> {
  const checkedAt = new Date().toISOString();

  // custom provider 跳过验证
  if (provider === 'custom') {
    logger.debug('Skipping validation for custom provider');
    return {
      valid: true,
      status: 'skipped',
      provider,
      checkedAt,
    };
  }

  const endpoint = getValidationEndpoint(provider, baseUrl);

  // 构建请求 URL（Gemini 需要将 key 作为查询参数）
  let requestUrl = endpoint.url;
  if (provider === 'gemini') {
    requestUrl = `${endpoint.url}?key=${key}`;
  }

  // 使用 AbortController 设置 15 秒超时
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    logger.debug(`Validating ${provider} API key`);

    const fetchOptions: RequestInit = {
      method: endpoint.method,
      headers: endpoint.headers(key),
      signal: controller.signal,
    };

    if (endpoint.body) {
      fetchOptions.body = endpoint.body(key);
    }

    const response = await fetch(requestUrl, fetchOptions);

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }

    const result = endpoint.parseResponse(response.status, responseBody);
    logger.info(`Validation result for ${provider}: ${result.status}`);
    return result;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    if (
      error instanceof Error &&
      error.name === 'AbortError'
    ) {
      logger.warn(`Validation timeout for ${provider}`);
      return {
        valid: false,
        status: 'network_error',
        error: 'Request timed out after 15 seconds',
        provider,
        checkedAt,
      };
    }

    logger.error(`Validation failed for ${provider}`, error);
    return {
      valid: false,
      status: 'network_error',
      error: errorMessage,
      provider,
      checkedAt,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
