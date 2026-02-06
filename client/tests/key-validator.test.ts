import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('../src/shared/logger', () => ({
  Logger: class { debug() {} info() {} warn() {} error() {} },
}));

import { validateApiKey, getValidationEndpoint } from '../src/shared/key-validator';

describe('Key 验证器', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getValidationEndpoint', () => {
    it('应该返回 Claude 的验证端点', () => {
      const endpoint = getValidationEndpoint('claude');
      expect(endpoint.url).toContain('anthropic');
      expect(endpoint.method).toBe('POST');
    });

    it('应该返回 OpenAI 的验证端点', () => {
      const endpoint = getValidationEndpoint('openai');
      expect(endpoint.url).toContain('openai');
      expect(endpoint.method).toBe('GET');
    });

    it('应该返回 Gemini 的验证端点', () => {
      const endpoint = getValidationEndpoint('gemini');
      expect(endpoint.url).toContain('generativelanguage');
    });

    it('应该返回 DeepSeek 的验证端点', () => {
      const endpoint = getValidationEndpoint('deepseek');
      expect(endpoint.url).toContain('deepseek');
    });
  });

  describe('validateApiKey', () => {
    it('Claude Key 有效时应该返回 valid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ type: 'message' }),
      });
      const result = await validateApiKey('claude', 'sk-ant-test-key');
      expect(result.valid).toBe(true);
      expect(result.status).toBe('valid');
    });

    it('Claude Key 无效时应该返回 invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ type: 'error', error: { type: 'authentication_error' } }),
      });
      const result = await validateApiKey('claude', 'invalid-key');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('OpenAI Key 有效时应该返回 valid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'gpt-4' }] }),
      });
      const result = await validateApiKey('openai', 'sk-test-key');
      expect(result.valid).toBe(true);
    });

    it('网络错误应该返回 network_error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await validateApiKey('claude', 'sk-ant-test');
      expect(result.valid).toBe(false);
      expect(result.status).toBe('network_error');
    });

    it('Key 被限流应该返回 rate_limited 但仍有效', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { type: 'rate_limit_error' } }),
      });
      const result = await validateApiKey('claude', 'sk-ant-test');
      expect(result.status).toBe('rate_limited');
      expect(result.valid).toBe(true);
    });

    it('custom provider 应该跳过验证', async () => {
      const result = await validateApiKey('custom', 'any-key');
      expect(result.valid).toBe(true);
      expect(result.status).toBe('skipped');
    });
  });
});
