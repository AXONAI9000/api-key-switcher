namespace ApiKeySyncServer.Models;

/// <summary>
/// 用户实体
/// </summary>
public class User
{
    public Guid Id { get; set; }

    /// <summary>
    /// 邮箱（唯一，用于登录）
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// 用户名（显示名称）
    /// </summary>
    public string Username { get; set; } = string.Empty;

    /// <summary>
    /// BCrypt 哈希后的密码
    /// </summary>
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>
    /// 创建时间
    /// </summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// 最后登录时间
    /// </summary>
    public DateTime? LastLoginAt { get; set; }

    /// <summary>
    /// 是否激活
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// 关联的刷新令牌
    /// </summary>
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}

/// <summary>
/// 刷新令牌实体
/// </summary>
public class RefreshToken
{
    public Guid Id { get; set; }

    /// <summary>
    /// 用户 ID
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// 令牌值
    /// </summary>
    public string Token { get; set; } = string.Empty;

    /// <summary>
    /// 设备 ID
    /// </summary>
    public string DeviceId { get; set; } = string.Empty;

    /// <summary>
    /// 设备名称
    /// </summary>
    public string? DeviceName { get; set; }

    /// <summary>
    /// 创建时间
    /// </summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// 过期时间
    /// </summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// 是否已撤销
    /// </summary>
    public bool IsRevoked { get; set; } = false;

    /// <summary>
    /// 关联的用户
    /// </summary>
    public User User { get; set; } = null!;
}
