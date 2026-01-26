using Microsoft.AspNetCore.Mvc;
using ApiKeySyncServer.Models;
using ApiKeySyncServer.Services;

namespace ApiKeySyncServer.Controllers;

/// <summary>
/// 认证 API 控制器
/// </summary>
[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    /// <summary>
    /// 获取当前用户 ID
    /// </summary>
    private Guid? GetCurrentUserId()
    {
        if (HttpContext.Items["UserId"] is Guid userId)
        {
            return userId;
        }
        return null;
    }

    /// <summary>
    /// 注册
    /// </summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(TokenResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(TokenResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<TokenResponse>> Register([FromBody] RegisterRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new TokenResponse
            {
                Success = false,
                Message = "请求参数无效"
            });
        }

        var result = await _authService.RegisterAsync(request);

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// 登录
    /// </summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(TokenResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(TokenResponse), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<TokenResponse>> Login([FromBody] LoginRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new TokenResponse
            {
                Success = false,
                Message = "请求参数无效"
            });
        }

        var result = await _authService.LoginAsync(request);

        if (!result.Success)
        {
            return Unauthorized(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// 刷新令牌
    /// </summary>
    [HttpPost("refresh")]
    [ProducesResponseType(typeof(TokenResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(TokenResponse), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<TokenResponse>> Refresh([FromBody] RefreshTokenRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new TokenResponse
            {
                Success = false,
                Message = "请求参数无效"
            });
        }

        var result = await _authService.RefreshTokenAsync(request.RefreshToken);

        if (!result.Success)
        {
            return Unauthorized(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// 登出
    /// </summary>
    [HttpPost("logout")]
    [ProducesResponseType(typeof(OperationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<OperationResponse>> Logout([FromBody] RefreshTokenRequest? request = null)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new OperationResponse
            {
                Success = false,
                Message = "未授权"
            });
        }

        var result = await _authService.LogoutAsync(userId.Value, request?.RefreshToken);
        return Ok(result);
    }

    /// <summary>
    /// 获取当前用户信息
    /// </summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(UserInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UserInfo>> GetCurrentUser()
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new ErrorResponse { Error = "未授权" });
        }

        var userInfo = await _authService.GetUserInfoAsync(userId.Value);
        if (userInfo == null)
        {
            return NotFound(new ErrorResponse { Error = "用户不存在" });
        }

        return Ok(userInfo);
    }

    /// <summary>
    /// 修改密码
    /// </summary>
    [HttpPut("password")]
    [ProducesResponseType(typeof(OperationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(OperationResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<OperationResponse>> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new OperationResponse
            {
                Success = false,
                Message = "未授权"
            });
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(new OperationResponse
            {
                Success = false,
                Message = "请求参数无效"
            });
        }

        var result = await _authService.ChangePasswordAsync(userId.Value, request);

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }
}
