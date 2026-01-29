using ApiKeySyncServer.Models;

namespace ApiKeySyncServer.Services;

/// <summary>
/// 认证服务接口
/// </summary>
public interface IAuthService
{
    /// <summary>
    /// 注册新用户
    /// </summary>
    Task<TokenResponse> RegisterAsync(RegisterRequest request);

    /// <summary>
    /// 用户登录
    /// </summary>
    Task<TokenResponse> LoginAsync(LoginRequest request);

    /// <summary>
    /// 刷新令牌
    /// </summary>
    Task<TokenResponse> RefreshTokenAsync(string refreshToken);

    /// <summary>
    /// 登出（撤销刷新令牌）
    /// </summary>
    Task<OperationResponse> LogoutAsync(Guid userId, string? refreshToken = null);

    /// <summary>
    /// 获取用户信息
    /// </summary>
    Task<UserInfo?> GetUserInfoAsync(Guid userId);

    /// <summary>
    /// 修改密码
    /// </summary>
    Task<OperationResponse> ChangePasswordAsync(Guid userId, ChangePasswordRequest request);

    /// <summary>
    /// 根据 ID 获取用户
    /// </summary>
    Task<User?> GetUserByIdAsync(Guid userId);
}
