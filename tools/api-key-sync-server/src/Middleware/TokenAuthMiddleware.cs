using ApiKeySyncServer.Services;

namespace ApiKeySyncServer.Middleware;

/// <summary>
/// Token 认证中间件
/// </summary>
public class TokenAuthMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<TokenAuthMiddleware> _logger;

    public TokenAuthMiddleware(RequestDelegate next, ILogger<TokenAuthMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, ISyncService syncService)
    {
        // 跳过健康检查和 Swagger 端点
        var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";
        if (path == "/health" || path.StartsWith("/swagger"))
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

        // 验证 Token
        if (!syncService.ValidateToken(token))
        {
            _logger.LogWarning("Invalid token for path: {Path}", path);
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { error = "Invalid token" });
            return;
        }

        // 将 Token 存储到 HttpContext.Items 中供后续使用
        context.Items["Token"] = token;

        // 提取设备 ID（如果有）
        var deviceId = context.Request.Headers["X-Device-Id"].FirstOrDefault();
        if (!string.IsNullOrEmpty(deviceId))
        {
            context.Items["DeviceId"] = deviceId;
        }

        await _next(context);
    }
}

/// <summary>
/// 中间件扩展方法
/// </summary>
public static class TokenAuthMiddlewareExtensions
{
    public static IApplicationBuilder UseTokenAuth(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<TokenAuthMiddleware>();
    }
}
