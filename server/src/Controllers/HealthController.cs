using Microsoft.AspNetCore.Mvc;

namespace ApiKeySyncServer.Controllers;

/// <summary>
/// 健康检查控制器
/// </summary>
[ApiController]
public class HealthController : ControllerBase
{
    /// <summary>
    /// 健康检查端点
    /// </summary>
    [HttpGet("/health")]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status200OK)]
    public ActionResult<HealthResponse> Health()
    {
        return Ok(new HealthResponse
        {
            Status = "healthy",
            Timestamp = DateTime.UtcNow.ToString("o"),
            Version = "1.0.0"
        });
    }
}

/// <summary>
/// 健康检查响应
/// </summary>
public class HealthResponse
{
    public required string Status { get; set; }
    public required string Timestamp { get; set; }
    public required string Version { get; set; }
}
