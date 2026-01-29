using ApiKeySyncServer.Models;

namespace ApiKeySyncServer.Services;

/// <summary>
/// JWT 服务接口
/// </summary>
public interface IJwtService
{
    /// <summary>
    /// 生成访问令牌
    /// </summary>
    string GenerateAccessToken(User user);

    /// <summary>
    /// 生成刷新令牌
    /// </summary>
    string GenerateRefreshToken();

    /// <summary>
    /// 验证访问令牌并返回用户 ID
    /// </summary>
    Guid? ValidateAccessToken(string token);

    /// <summary>
    /// 获取访问令牌过期时间（秒）
    /// </summary>
    int GetAccessTokenExpirationSeconds();

    /// <summary>
    /// 获取刷新令牌过期时间
    /// </summary>
    TimeSpan GetRefreshTokenExpiration();
}
