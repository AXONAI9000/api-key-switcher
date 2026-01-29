using Microsoft.EntityFrameworkCore;
using ApiKeySyncServer.Data;
using ApiKeySyncServer.Models;

namespace ApiKeySyncServer.Services;

/// <summary>
/// 认证服务实现
/// </summary>
public class AuthService : IAuthService
{
    private readonly AppDbContext _dbContext;
    private readonly IJwtService _jwtService;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        AppDbContext dbContext,
        IJwtService jwtService,
        ILogger<AuthService> logger)
    {
        _dbContext = dbContext;
        _jwtService = jwtService;
        _logger = logger;
    }

    /// <summary>
    /// 注册新用户
    /// </summary>
    public async Task<TokenResponse> RegisterAsync(RegisterRequest request)
    {
        // 检查邮箱是否已存在
        var existingUser = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower());

        if (existingUser != null)
        {
            return new TokenResponse
            {
                Success = false,
                Message = "该邮箱已被注册"
            };
        }

        // 创建新用户
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email.ToLower(),
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            CreatedAt = DateTime.UtcNow,
            LastLoginAt = DateTime.UtcNow,
            IsActive = true
        };

        _dbContext.Users.Add(user);

        // 生成令牌
        var accessToken = _jwtService.GenerateAccessToken(user);
        var refreshToken = _jwtService.GenerateRefreshToken();

        // 保存刷新令牌
        var deviceId = request.DeviceId ?? Guid.NewGuid().ToString();
        var refreshTokenEntity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = refreshToken,
            DeviceId = deviceId,
            DeviceName = request.DeviceName,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.Add(_jwtService.GetRefreshTokenExpiration()),
            IsRevoked = false
        };

        _dbContext.RefreshTokens.Add(refreshTokenEntity);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("User registered: {Email}", user.Email);

        return new TokenResponse
        {
            Success = true,
            Message = "注册成功",
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresIn = _jwtService.GetAccessTokenExpirationSeconds(),
            User = new UserInfo
            {
                Id = user.Id.ToString(),
                Email = user.Email,
                Username = user.Username,
                CreatedAt = user.CreatedAt.ToString("o")
            }
        };
    }

    /// <summary>
    /// 用户登录
    /// </summary>
    public async Task<TokenResponse> LoginAsync(LoginRequest request)
    {
        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower());

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return new TokenResponse
            {
                Success = false,
                Message = "邮箱或密码错误"
            };
        }

        if (!user.IsActive)
        {
            return new TokenResponse
            {
                Success = false,
                Message = "账户已被禁用"
            };
        }

        // 更新最后登录时间
        user.LastLoginAt = DateTime.UtcNow;

        // 生成令牌
        var accessToken = _jwtService.GenerateAccessToken(user);
        var refreshToken = _jwtService.GenerateRefreshToken();

        // 保存刷新令牌（如果同一设备已有令牌，则撤销旧的）
        var deviceId = request.DeviceId ?? Guid.NewGuid().ToString();

        var existingToken = await _dbContext.RefreshTokens
            .FirstOrDefaultAsync(t => t.UserId == user.Id && t.DeviceId == deviceId && !t.IsRevoked);

        if (existingToken != null)
        {
            existingToken.IsRevoked = true;
        }

        var refreshTokenEntity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = refreshToken,
            DeviceId = deviceId,
            DeviceName = request.DeviceName,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.Add(_jwtService.GetRefreshTokenExpiration()),
            IsRevoked = false
        };

        _dbContext.RefreshTokens.Add(refreshTokenEntity);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("User logged in: {Email}", user.Email);

        return new TokenResponse
        {
            Success = true,
            Message = "登录成功",
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresIn = _jwtService.GetAccessTokenExpirationSeconds(),
            User = new UserInfo
            {
                Id = user.Id.ToString(),
                Email = user.Email,
                Username = user.Username,
                CreatedAt = user.CreatedAt.ToString("o")
            }
        };
    }

    /// <summary>
    /// 刷新令牌
    /// </summary>
    public async Task<TokenResponse> RefreshTokenAsync(string refreshToken)
    {
        var tokenEntity = await _dbContext.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == refreshToken);

        if (tokenEntity == null)
        {
            return new TokenResponse
            {
                Success = false,
                Message = "无效的刷新令牌"
            };
        }

        if (tokenEntity.IsRevoked)
        {
            return new TokenResponse
            {
                Success = false,
                Message = "刷新令牌已被撤销"
            };
        }

        if (tokenEntity.ExpiresAt < DateTime.UtcNow)
        {
            return new TokenResponse
            {
                Success = false,
                Message = "刷新令牌已过期"
            };
        }

        if (!tokenEntity.User.IsActive)
        {
            return new TokenResponse
            {
                Success = false,
                Message = "账户已被禁用"
            };
        }

        // 撤销旧的刷新令牌
        tokenEntity.IsRevoked = true;

        // 生成新令牌
        var newAccessToken = _jwtService.GenerateAccessToken(tokenEntity.User);
        var newRefreshToken = _jwtService.GenerateRefreshToken();

        var newRefreshTokenEntity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = tokenEntity.UserId,
            Token = newRefreshToken,
            DeviceId = tokenEntity.DeviceId,
            DeviceName = tokenEntity.DeviceName,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.Add(_jwtService.GetRefreshTokenExpiration()),
            IsRevoked = false
        };

        _dbContext.RefreshTokens.Add(newRefreshTokenEntity);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Token refreshed for user: {UserId}", tokenEntity.UserId);

        return new TokenResponse
        {
            Success = true,
            Message = "令牌刷新成功",
            AccessToken = newAccessToken,
            RefreshToken = newRefreshToken,
            ExpiresIn = _jwtService.GetAccessTokenExpirationSeconds(),
            User = new UserInfo
            {
                Id = tokenEntity.User.Id.ToString(),
                Email = tokenEntity.User.Email,
                Username = tokenEntity.User.Username,
                CreatedAt = tokenEntity.User.CreatedAt.ToString("o")
            }
        };
    }

    /// <summary>
    /// 登出（撤销刷新令牌）
    /// </summary>
    public async Task<OperationResponse> LogoutAsync(Guid userId, string? refreshToken = null)
    {
        if (!string.IsNullOrEmpty(refreshToken))
        {
            // 撤销指定的刷新令牌
            var tokenEntity = await _dbContext.RefreshTokens
                .FirstOrDefaultAsync(t => t.UserId == userId && t.Token == refreshToken);

            if (tokenEntity != null)
            {
                tokenEntity.IsRevoked = true;
            }
        }
        else
        {
            // 撤销该用户的所有刷新令牌
            var tokens = await _dbContext.RefreshTokens
                .Where(t => t.UserId == userId && !t.IsRevoked)
                .ToListAsync();

            foreach (var token in tokens)
            {
                token.IsRevoked = true;
            }
        }

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("User logged out: {UserId}", userId);

        return new OperationResponse
        {
            Success = true,
            Message = "登出成功"
        };
    }

    /// <summary>
    /// 获取用户信息
    /// </summary>
    public async Task<UserInfo?> GetUserInfoAsync(Guid userId)
    {
        var user = await _dbContext.Users.FindAsync(userId);

        if (user == null)
        {
            return null;
        }

        return new UserInfo
        {
            Id = user.Id.ToString(),
            Email = user.Email,
            Username = user.Username,
            CreatedAt = user.CreatedAt.ToString("o")
        };
    }

    /// <summary>
    /// 修改密码
    /// </summary>
    public async Task<OperationResponse> ChangePasswordAsync(Guid userId, ChangePasswordRequest request)
    {
        var user = await _dbContext.Users.FindAsync(userId);

        if (user == null)
        {
            return new OperationResponse
            {
                Success = false,
                Message = "用户不存在"
            };
        }

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
        {
            return new OperationResponse
            {
                Success = false,
                Message = "当前密码错误"
            };
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

        // 撤销所有刷新令牌，强制重新登录
        var tokens = await _dbContext.RefreshTokens
            .Where(t => t.UserId == userId && !t.IsRevoked)
            .ToListAsync();

        foreach (var token in tokens)
        {
            token.IsRevoked = true;
        }

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Password changed for user: {UserId}", userId);

        return new OperationResponse
        {
            Success = true,
            Message = "密码修改成功，请重新登录"
        };
    }

    /// <summary>
    /// 根据 ID 获取用户
    /// </summary>
    public async Task<User?> GetUserByIdAsync(Guid userId)
    {
        return await _dbContext.Users.FindAsync(userId);
    }
}
