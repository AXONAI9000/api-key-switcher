using ApiKeySyncServer.Services;

namespace ApiKeySyncServer.Middleware;

/// <summary>
/// JWT 认证中间件
/// </summary>
public class JwtAuthMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<JwtAuthMiddleware> _logger;

    // 不需要认证的路径
    private static readonly string[] PublicPaths = new[]
    {
        "/health",
        "/swagger",
        "/api/v1/auth/register",
        "/api/v1/auth/login",
        "/api/v1/auth/refresh"
    };

    public JwtAuthMiddleware(RequestDelegate next, ILogger<JwtAuthMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IJwtService jwtService)
    {
        var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";

        // 检查是否是公开路径
        if (IsPublicPath(path))
        {
            await _next(context);
            return;
        }

        // 检查 Authorization 头
        var authHeader = context.Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader))
        {
            _logger.LogWarning("Missing Authorization header for path: {Path}", path);
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { error = "Missing Authorization header" });
            return;
        }

        // 解析 Bearer Token
        if (!authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Invalid Authorization header format for path: {Path}", path);
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { error = "Invalid Authorization header format" });
            return;
        }

        var token = authHeader["Bearer ".Length..].Trim();

        // 验证 JWT Token
        var userId = jwtService.ValidateAccessToken(token);
        if (userId == null)
        {
            _logger.LogWarning("Invalid or expired token for path: {Path}", path);
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { error = "Invalid or expired token" });
            return;
        }

        // 将用户 ID 存储到 HttpContext.Items 中供后续使用
        context.Items["UserId"] = userId.Value;

        // 提取设备 ID（如果有）
        var deviceId = context.Request.Headers["X-Device-Id"].FirstOrDefault();
        if (!string.IsNullOrEmpty(deviceId))
        {
            context.Items["DeviceId"] = deviceId;
        }

        await _next(context);
    }

    private static bool IsPublicPath(string path)
    {
        foreach (var publicPath in PublicPaths)
        {
            if (path == publicPath || path.StartsWith(publicPath + "/") || path.StartsWith(publicPath))
            {
                return true;
            }
        }
        return false;
    }
}

/// <summary>
/// 中间件扩展方法
/// </summary>
public static class JwtAuthMiddlewareExtensions
{
    public static IApplicationBuilder UseJwtAuth(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<JwtAuthMiddleware>();
    }
}
