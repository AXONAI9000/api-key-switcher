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
    /// 获取当前用户 ID
    /// </summary>
    private Guid? GetUserId()
    {
        if (HttpContext.Items["UserId"] is Guid userId)
        {
            return userId;
        }
        return null;
    }

    /// <summary>
    /// 获取同步状态
    /// </summary>
    [HttpGet("status")]
    [ProducesResponseType(typeof(SyncStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<SyncStatusResponse>> GetStatus()
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized(new ErrorResponse { Error = "未授权" });
        }

        var status = await _syncService.GetStatusAsync(userId.Value);
        return Ok(status);
    }

    /// <summary>
    /// 获取配置
    /// </summary>
    [HttpGet("config")]
    [ProducesResponseType(typeof(ConfigResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ConfigResponse>> GetConfig()
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized(new ErrorResponse { Error = "未授权" });
        }

        var config = await _syncService.GetConfigAsync(userId.Value);

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
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<PushResponse>> PutConfig([FromBody] PushRequest request)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized(new ErrorResponse { Error = "未授权" });
        }

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

        var result = await _syncService.SaveConfigAsync(userId.Value, request.Data);

        if (!result.Success)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new ErrorResponse { Error = "Failed to save configuration" });
        }

        return Ok(result);
    }
}
