using ApiKeySyncServer.Models;

namespace ApiKeySyncServer.Services;

/// <summary>
/// 同步服务接口
/// </summary>
public interface ISyncService
{
    /// <summary>
    /// 获取同步状态
    /// </summary>
    Task<SyncStatusResponse> GetStatusAsync(string token);

    /// <summary>
    /// 获取配置
    /// </summary>
    Task<EncryptedPackage?> GetConfigAsync(string token);

    /// <summary>
    /// 保存配置
    /// </summary>
    Task<PushResponse> SaveConfigAsync(string token, EncryptedPackage data);

    /// <summary>
    /// 验证 Token
    /// </summary>
    bool ValidateToken(string token);
}
