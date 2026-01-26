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
    Task<SyncStatusResponse> GetStatusAsync(Guid userId);

    /// <summary>
    /// 获取配置
    /// </summary>
    Task<EncryptedPackage?> GetConfigAsync(Guid userId);

    /// <summary>
    /// 保存配置
    /// </summary>
    Task<PushResponse> SaveConfigAsync(Guid userId, EncryptedPackage data);
}
