using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ApiKeySyncServer.Models;

namespace ApiKeySyncServer.Services;

/// <summary>
/// 同步服务实现
/// </summary>
public class SyncService : ISyncService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<SyncService> _logger;
    private readonly string _dataDirectory;

    public SyncService(IConfiguration configuration, ILogger<SyncService> logger)
    {
        _configuration = configuration;
        _logger = logger;
        _dataDirectory = configuration["DataDirectory"] ?? Path.Combine(AppContext.BaseDirectory, "data");

        // 确保数据目录存在
        if (!Directory.Exists(_dataDirectory))
        {
            Directory.CreateDirectory(_dataDirectory);
        }
    }

    /// <summary>
    /// 验证 Token
    /// </summary>
    public bool ValidateToken(string token)
    {
        if (string.IsNullOrEmpty(token))
        {
            return false;
        }

        var validTokens = _configuration.GetSection("ValidTokens").Get<string[]>();
        if (validTokens == null || validTokens.Length == 0)
        {
            // 如果没有配置 Token，使用默认 Token
            var defaultToken = _configuration["DefaultToken"];
            return !string.IsNullOrEmpty(defaultToken) && token == defaultToken;
        }

        return validTokens.Contains(token);
    }

    /// <summary>
    /// 获取用户数据文件路径
    /// </summary>
    private string GetUserDataPath(string token)
    {
        // 使用 Token 的哈希作为文件名，避免直接暴露 Token
        using var sha256 = SHA256.Create();
        var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(token));
        var hashString = Convert.ToHexString(hashBytes).ToLowerInvariant();
        return Path.Combine(_dataDirectory, $"{hashString}.json");
    }

    /// <summary>
    /// 获取同步状态
    /// </summary>
    public async Task<SyncStatusResponse> GetStatusAsync(string token)
    {
        var filePath = GetUserDataPath(token);
        var response = new SyncStatusResponse
        {
            Connected = true,
            HasData = File.Exists(filePath)
        };

        if (response.HasData)
        {
            try
            {
                var content = await File.ReadAllTextAsync(filePath);
                var data = JsonSerializer.Deserialize<EncryptedPackage>(content, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (data != null)
                {
                    response.LastUpdated = data.Timestamp;
                    response.DeviceId = data.DeviceId;
                    response.Version = data.Version;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to read status from file: {FilePath}", filePath);
            }
        }

        return response;
    }

    /// <summary>
    /// 获取配置
    /// </summary>
    public async Task<EncryptedPackage?> GetConfigAsync(string token)
    {
        var filePath = GetUserDataPath(token);

        if (!File.Exists(filePath))
        {
            return null;
        }

        try
        {
            var content = await File.ReadAllTextAsync(filePath);
            return JsonSerializer.Deserialize<EncryptedPackage>(content, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to read config from file: {FilePath}", filePath);
            return null;
        }
    }

    /// <summary>
    /// 保存配置
    /// </summary>
    public async Task<PushResponse> SaveConfigAsync(string token, EncryptedPackage data)
    {
        var filePath = GetUserDataPath(token);
        var timestamp = DateTime.UtcNow.ToString("o");

        try
        {
            var content = JsonSerializer.Serialize(data, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            await File.WriteAllTextAsync(filePath, content);

            _logger.LogInformation("Config saved for token hash: {TokenHash}", Path.GetFileNameWithoutExtension(filePath));

            return new PushResponse
            {
                Success = true,
                Timestamp = timestamp
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save config to file: {FilePath}", filePath);
            return new PushResponse
            {
                Success = false,
                Timestamp = timestamp
            };
        }
    }
}
