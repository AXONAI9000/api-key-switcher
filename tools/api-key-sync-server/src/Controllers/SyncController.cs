using Microsoft.AspNetCore.Mvc;
using ApiKeySyncServer.Models;
using ApiKeySyncServer.Services;

namespace ApiKeySyncServer.Controllers;

/// <summary>
/// 同步 API 控制器
/// </summary>
[ApiController]
[Route("api/v1/sync")]
public class SyncController : ControllerBase
{
    private readonly ISyncService _syncService;
    private readonly ILogger<SyncController> _logger;

    public SyncController(ISyncService syncService, ILogger<SyncController> logger)
    {
        _syncService = syncService;
        _logger = logger;
    }

    /// <summary>
    /// 获取当前请求的 Token
    /// </summary>
    private string GetToken()
    {
        return HttpContext.Items["Token"] as string ?? string.Empty;
    }

    /// <summary>
    /// 获取同步状态
    /// </summary>
    [HttpGet("status")]
    [ProducesResponseType(typeof(SyncStatusResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<SyncStatusResponse>> GetStatus()
    {
        var token = GetToken();
        var status = await _syncService.GetStatusAsync(token);
        return Ok(status);
    }

    /// <summary>
    /// 获取配置
    /// </summary>
    [HttpGet("config")]
    [ProducesResponseType(typeof(ConfigResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ConfigResponse>> GetConfig()
    {
        var token = GetToken();
        var config = await _syncService.GetConfigAsync(token);

        if (config == null)
        {
            return NotFound(new ErrorResponse { Error = "No configuration found" });
        }

        return Ok(new ConfigResponse { Data = config });
    }

    /// <summary>
    /// 上传配置
    /// </summary>
    [HttpPut("config")]
    [ProducesResponseType(typeof(PushResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PushResponse>> PutConfig([FromBody] PushRequest request)
    {
        if (request?.Data == null)
        {
            return BadRequest(new ErrorResponse { Error = "Invalid request body" });
        }

        // 验证数据包
        if (string.IsNullOrEmpty(request.Data.EncryptedData) ||
            string.IsNullOrEmpty(request.Data.Iv) ||
            string.IsNullOrEmpty(request.Data.Salt) ||
            string.IsNullOrEmpty(request.Data.Checksum))
        {
            return BadRequest(new ErrorResponse { Error = "Invalid encrypted package" });
        }

        var token = GetToken();
        var result = await _syncService.SaveConfigAsync(token, request.Data);

        if (!result.Success)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new ErrorResponse { Error = "Failed to save configuration" });
        }

        return Ok(result);
    }

    /// <summary>
    /// 验证 Token
    /// </summary>
    [HttpPost("auth")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    public ActionResult<AuthResponse> Auth()
    {
        // 如果能到达这里，说明 Token 已经通过中间件验证
        return Ok(new AuthResponse
        {
            Success = true,
            Message = "Token is valid"
        });
    }
}
