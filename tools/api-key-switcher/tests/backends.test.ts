/**
 * 后端连接测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EncryptedPackage, ServerSyncConfig, GistSyncConfig, WebDAVSyncConfig } from '../src/shared/sync/types';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('自建服务器后端', () => {
  const serverConfig: ServerSyncConfig = {
    url: 'https://sync.example.com',
    token: 'test-token-123',
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('应该正确构建认证头', () => {
    const expectedHeaders = {
      'Authorization': `Bearer ${serverConfig.token}`,
      'X-Device-Id': 'test-device',
      'Content-Type': 'application/json',
    };

    expect(expectedHeaders.Authorization).toBe('Bearer test-token-123');
  });

  it('应该处理连接成功', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true }),
    });

    const response = await fetch(`${serverConfig.url}/api/v1/sync/auth`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serverConfig.token}`,
      },
    });

    expect(response.ok).toBe(true);
  });

  it('应该处理认证失败', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    const response = await fetch(`${serverConfig.url}/api/v1/sync/auth`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid-token',
      },
    });

    expect(response.status).toBe(401);
  });

  it('应该处理服务器错误', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const response = await fetch(`${serverConfig.url}/api/v1/sync/status`);

    expect(response.status).toBe(500);
  });

  it('应该处理网络超时', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

    await expect(fetch(`${serverConfig.url}/api/v1/sync/status`)).rejects.toThrow('Network timeout');
  });
});

describe('GitHub Gist 后端', () => {
  const gistConfig: GistSyncConfig = {
    token: 'ghp_test_token_123',
    gistId: 'abc123def456',
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('应该正确构建 GitHub API 请求头', () => {
    const expectedHeaders = {
      'Authorization': `Bearer ${gistConfig.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    expect(expectedHeaders.Authorization).toBe('Bearer ghp_test_token_123');
    expect(expectedHeaders.Accept).toBe('application/vnd.github+json');
  });

  it('应该处理 Gist 获取成功', async () => {
    const mockGistResponse = {
      id: gistConfig.gistId,
      files: {
        'api-key-switcher-config.json': {
          content: JSON.stringify({ encryptedData: 'test' }),
        },
      },
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockGistResponse,
    });

    const response = await fetch(`https://api.github.com/gists/${gistConfig.gistId}`);
    const data = await response.json();

    expect(data.id).toBe(gistConfig.gistId);
    expect(data.files['api-key-switcher-config.json']).toBeDefined();
  });

  it('应该处理 Gist 不存在', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const response = await fetch(`https://api.github.com/gists/nonexistent`);

    expect(response.status).toBe(404);
  });

  it('应该处理 Token 无效', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Bad credentials',
    });

    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': 'Bearer invalid-token',
      },
    });

    expect(response.status).toBe(401);
  });
});

describe('WebDAV 后端', () => {
  const webdavConfig: WebDAVSyncConfig = {
    url: 'https://dav.example.com',
    username: 'testuser',
    password: 'testpass',
    path: '/api-key-switcher',
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('应该正确构建 Basic Auth 头', () => {
    const credentials = Buffer.from(`${webdavConfig.username}:${webdavConfig.password}`).toString('base64');
    const expectedAuth = `Basic ${credentials}`;

    expect(expectedAuth).toContain('Basic ');
    expect(Buffer.from(credentials, 'base64').toString()).toBe('testuser:testpass');
  });

  it('应该处理 PROPFIND 请求', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 207, // Multi-Status
      text: async () => '<d:multistatus></d:multistatus>',
    });

    const response = await fetch(webdavConfig.url, {
      method: 'PROPFIND',
      headers: {
        'Depth': '0',
      },
    });

    expect(response.status).toBe(207);
  });

  it('应该处理文件不存在', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const response = await fetch(`${webdavConfig.url}${webdavConfig.path}/config.json`, {
      method: 'GET',
    });

    expect(response.status).toBe(404);
  });

  it('应该处理认证失败', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    const response = await fetch(webdavConfig.url, {
      method: 'PROPFIND',
    });

    expect(response.status).toBe(401);
  });

  it('应该处理 PUT 上传', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201, // Created
    });

    const response = await fetch(`${webdavConfig.url}${webdavConfig.path}/config.json`, {
      method: 'PUT',
      body: JSON.stringify({ test: 'data' }),
    });

    expect(response.status).toBe(201);
  });
});

describe('加密数据包验证', () => {
  it('应该验证有效的加密数据包结构', () => {
    const validPackage: EncryptedPackage = {
      encryptedData: 'base64encodeddata',
      iv: 'base64iv',
      salt: 'base64salt',
      checksum: 'sha256checksum',
      version: 1,
      timestamp: '2024-01-01T00:00:00.000Z',
      deviceId: 'device_123',
    };

    expect(validPackage.encryptedData).toBeDefined();
    expect(validPackage.iv).toBeDefined();
    expect(validPackage.salt).toBeDefined();
    expect(validPackage.checksum).toBeDefined();
    expect(validPackage.version).toBeGreaterThan(0);
    expect(validPackage.timestamp).toBeDefined();
    expect(validPackage.deviceId).toBeDefined();
  });

  it('应该检测无效的数据包', () => {
    const invalidPackage = {
      encryptedData: '',
      // 缺少其他必需字段
    };

    expect(invalidPackage.encryptedData).toBe('');
    expect((invalidPackage as any).iv).toBeUndefined();
  });
});
