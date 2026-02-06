using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using ApiKeySyncServer.Data;
using ApiKeySyncServer.Models;
using ApiKeySyncServer.Services;

namespace ApiKeySyncServer.Tests;

public class AuthServiceTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly Mock<IJwtService> _jwtServiceMock;
    private readonly AuthService _authService;

    public AuthServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _dbContext = new AppDbContext(options);
        _jwtServiceMock = new Mock<IJwtService>();
        var loggerMock = new Mock<ILogger<AuthService>>();

        _jwtServiceMock.Setup(j => j.GenerateAccessToken(It.IsAny<User>())).Returns("test-access-token");
        _jwtServiceMock.Setup(j => j.GenerateRefreshToken()).Returns("test-refresh-token");
        _jwtServiceMock.Setup(j => j.GetAccessTokenExpirationSeconds()).Returns(3600);
        _jwtServiceMock.Setup(j => j.GetRefreshTokenExpiration()).Returns(TimeSpan.FromDays(7));

        _authService = new AuthService(_dbContext, _jwtServiceMock.Object, loggerMock.Object);
    }

    public void Dispose()
    {
        _dbContext.Database.EnsureDeleted();
        _dbContext.Dispose();
    }

    [Fact]
    public async Task RegisterAsync_ShouldCreateNewUser()
    {
        var request = new RegisterRequest
        {
            Email = "test@example.com",
            Username = "testuser",
            Password = "Password123",
            DeviceId = "device-1"
        };

        var result = await _authService.RegisterAsync(request);

        Assert.True(result.Success);
        Assert.Equal("test-access-token", result.AccessToken);
        Assert.Equal("test-refresh-token", result.RefreshToken);
        Assert.NotNull(result.User);
        Assert.Equal("test@example.com", result.User!.Email);
    }

    [Fact]
    public async Task RegisterAsync_DuplicateEmail_ShouldFail()
    {
        var request = new RegisterRequest
        {
            Email = "dup@example.com",
            Username = "user1",
            Password = "Password123"
        };

        await _authService.RegisterAsync(request);

        var request2 = new RegisterRequest
        {
            Email = "dup@example.com",
            Username = "user2",
            Password = "Password456"
        };

        var result = await _authService.RegisterAsync(request2);

        Assert.False(result.Success);
        Assert.Contains("已被注册", result.Message);
    }

    [Fact]
    public async Task LoginAsync_ValidCredentials_ShouldSucceed()
    {
        var registerRequest = new RegisterRequest
        {
            Email = "login@example.com",
            Username = "loginuser",
            Password = "Password123",
            DeviceId = "device-1"
        };
        await _authService.RegisterAsync(registerRequest);

        // GenerateRefreshToken returns same value, need unique for login
        _jwtServiceMock.Setup(j => j.GenerateRefreshToken()).Returns("login-refresh-token");

        var loginRequest = new LoginRequest
        {
            Email = "login@example.com",
            Password = "Password123",
            DeviceId = "device-2"
        };

        var result = await _authService.LoginAsync(loginRequest);

        Assert.True(result.Success);
        Assert.Equal("test-access-token", result.AccessToken);
        Assert.NotNull(result.User);
    }

    [Fact]
    public async Task LoginAsync_WrongPassword_ShouldFail()
    {
        var registerRequest = new RegisterRequest
        {
            Email = "wrong@example.com",
            Username = "wronguser",
            Password = "CorrectPassword"
        };
        await _authService.RegisterAsync(registerRequest);

        var loginRequest = new LoginRequest
        {
            Email = "wrong@example.com",
            Password = "WrongPassword"
        };

        var result = await _authService.LoginAsync(loginRequest);

        Assert.False(result.Success);
        Assert.Contains("密码错误", result.Message);
    }

    [Fact]
    public async Task LoginAsync_NonexistentUser_ShouldFail()
    {
        var loginRequest = new LoginRequest
        {
            Email = "nonexistent@example.com",
            Password = "Password123"
        };

        var result = await _authService.LoginAsync(loginRequest);

        Assert.False(result.Success);
    }

    [Fact]
    public async Task RefreshTokenAsync_ValidToken_ShouldSucceed()
    {
        var registerRequest = new RegisterRequest
        {
            Email = "refresh@example.com",
            Username = "refreshuser",
            Password = "Password123"
        };
        await _authService.RegisterAsync(registerRequest);

        _jwtServiceMock.Setup(j => j.GenerateRefreshToken()).Returns("new-refresh-token");

        var result = await _authService.RefreshTokenAsync("test-refresh-token");

        Assert.True(result.Success);
        Assert.Equal("new-refresh-token", result.RefreshToken);
    }

    [Fact]
    public async Task RefreshTokenAsync_InvalidToken_ShouldFail()
    {
        var result = await _authService.RefreshTokenAsync("invalid-token");

        Assert.False(result.Success);
        Assert.Contains("无效", result.Message);
    }

    [Fact]
    public async Task RefreshTokenAsync_RevokedToken_ShouldFail()
    {
        var registerRequest = new RegisterRequest
        {
            Email = "revoked@example.com",
            Username = "revokeduser",
            Password = "Password123"
        };
        await _authService.RegisterAsync(registerRequest);

        // Revoke the token
        var token = await _dbContext.RefreshTokens.FirstAsync(t => t.Token == "test-refresh-token");
        token.IsRevoked = true;
        await _dbContext.SaveChangesAsync();

        var result = await _authService.RefreshTokenAsync("test-refresh-token");

        Assert.False(result.Success);
        Assert.Contains("撤销", result.Message);
    }

    [Fact]
    public async Task LogoutAsync_ShouldRevokeToken()
    {
        var registerRequest = new RegisterRequest
        {
            Email = "logout@example.com",
            Username = "logoutuser",
            Password = "Password123"
        };
        var registerResult = await _authService.RegisterAsync(registerRequest);
        var userId = Guid.Parse(registerResult.User!.Id);

        var result = await _authService.LogoutAsync(userId, "test-refresh-token");

        Assert.True(result.Success);

        var token = await _dbContext.RefreshTokens.FirstAsync(t => t.Token == "test-refresh-token");
        Assert.True(token.IsRevoked);
    }

    [Fact]
    public async Task LogoutAsync_WithoutToken_ShouldRevokeAllTokens()
    {
        var registerRequest = new RegisterRequest
        {
            Email = "logoutall@example.com",
            Username = "logoutalluser",
            Password = "Password123"
        };
        var registerResult = await _authService.RegisterAsync(registerRequest);
        var userId = Guid.Parse(registerResult.User!.Id);

        var result = await _authService.LogoutAsync(userId);

        Assert.True(result.Success);

        var activeTokens = await _dbContext.RefreshTokens
            .Where(t => t.UserId == userId && !t.IsRevoked)
            .CountAsync();
        Assert.Equal(0, activeTokens);
    }

    [Fact]
    public async Task GetUserInfoAsync_ExistingUser_ShouldReturnInfo()
    {
        var registerRequest = new RegisterRequest
        {
            Email = "info@example.com",
            Username = "infouser",
            Password = "Password123"
        };
        var registerResult = await _authService.RegisterAsync(registerRequest);
        var userId = Guid.Parse(registerResult.User!.Id);

        var userInfo = await _authService.GetUserInfoAsync(userId);

        Assert.NotNull(userInfo);
        Assert.Equal("info@example.com", userInfo!.Email);
        Assert.Equal("infouser", userInfo.Username);
    }

    [Fact]
    public async Task GetUserInfoAsync_NonexistentUser_ShouldReturnNull()
    {
        var userInfo = await _authService.GetUserInfoAsync(Guid.NewGuid());

        Assert.Null(userInfo);
    }

    [Fact]
    public async Task ChangePasswordAsync_ValidCurrentPassword_ShouldSucceed()
    {
        var registerRequest = new RegisterRequest
        {
            Email = "changepw@example.com",
            Username = "changepwuser",
            Password = "OldPassword123"
        };
        var registerResult = await _authService.RegisterAsync(registerRequest);
        var userId = Guid.Parse(registerResult.User!.Id);

        var changeRequest = new ChangePasswordRequest
        {
            CurrentPassword = "OldPassword123",
            NewPassword = "NewPassword456"
        };

        var result = await _authService.ChangePasswordAsync(userId, changeRequest);

        Assert.True(result.Success);

        // Verify old password no longer works
        var loginResult = await _authService.LoginAsync(new LoginRequest
        {
            Email = "changepw@example.com",
            Password = "OldPassword123"
        });
        Assert.False(loginResult.Success);
    }

    [Fact]
    public async Task ChangePasswordAsync_WrongCurrentPassword_ShouldFail()
    {
        var registerRequest = new RegisterRequest
        {
            Email = "wrongpw@example.com",
            Username = "wrongpwuser",
            Password = "CorrectPassword"
        };
        var registerResult = await _authService.RegisterAsync(registerRequest);
        var userId = Guid.Parse(registerResult.User!.Id);

        var changeRequest = new ChangePasswordRequest
        {
            CurrentPassword = "WrongPassword",
            NewPassword = "NewPassword456"
        };

        var result = await _authService.ChangePasswordAsync(userId, changeRequest);

        Assert.False(result.Success);
        Assert.Contains("密码错误", result.Message);
    }

    [Fact]
    public async Task LoginAsync_DisabledUser_ShouldFail()
    {
        var registerRequest = new RegisterRequest
        {
            Email = "disabled@example.com",
            Username = "disableduser",
            Password = "Password123"
        };
        await _authService.RegisterAsync(registerRequest);

        // Disable the user
        var user = await _dbContext.Users.FirstAsync(u => u.Email == "disabled@example.com");
        user.IsActive = false;
        await _dbContext.SaveChangesAsync();

        var loginRequest = new LoginRequest
        {
            Email = "disabled@example.com",
            Password = "Password123"
        };

        var result = await _authService.LoginAsync(loginRequest);

        Assert.False(result.Success);
        Assert.Contains("禁用", result.Message);
    }
}
