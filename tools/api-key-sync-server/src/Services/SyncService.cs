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
        var configsDir = Path.Combine(_dataDirectory, "configs");
        if (!Directory.Exists(configsDir))
        {
            Directory.CreateDirectory(configsDir);
        }
    }

    /// <summary>
    /// 获取用户数据文件路径
    /// </summary>
    private string GetUserDataPath(Guid userId)
    {
        return Path.Combine(_dataDirectory, "configs", $"{userId}.json");
    }

    /// <summary>
    /// 获取同步状态
    /// </summary>
    public async Task<SyncStatusResponse> GetStatusAsync(Guid userId)
    {
        var filePath = GetUserDataPath(userId);
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
    public async Task<EncryptedPackage?> GetConfigAsync(Guid userId)
    {
        var filePath = GetUserDataPath(userId);

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
    public async Task<PushResponse> SaveConfigAsync(Guid userId, EncryptedPackage data)
    {
        var filePath = GetUserDataPath(userId);
        var timestamp = DateTime.UtcNow.ToString("o");

        try
        {
            var content = JsonSerializer.Serialize(data, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            await File.WriteAllTextAsync(filePath, content);

            _logger.LogInformation("Config saved for user: {UserId}", userId);

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
