namespace ApiKeySyncServer.Models;

/// <summary>
/// 加密数据包
/// </summary>
public class EncryptedPackage
{
    /// <summary>
    /// Base64 编码的加密数据
    /// </summary>
    public required string EncryptedData { get; set; }

    /// <summary>
    /// Base64 编码的初始化向量
    /// </summary>
    public required string Iv { get; set; }

    /// <summary>
    /// Base64 编码的盐值
    /// </summary>
    public required string Salt { get; set; }

    /// <summary>
    /// SHA-256 校验和
    /// </summary>
    public required string Checksum { get; set; }

    /// <summary>
    /// 数据格式版本
    /// </summary>
    public int Version { get; set; }

    /// <summary>
    /// ISO 时间戳
    /// </summary>
    public required string Timestamp { get; set; }

    /// <summary>
    /// 设备 ID
    /// </summary>
    public required string DeviceId { get; set; }
}

/// <summary>
/// 同步状态响应
/// </summary>
public class SyncStatusResponse
{
    /// <summary>
    /// 是否已连接
    /// </summary>
    public bool Connected { get; set; } = true;

    /// <summary>
    /// 是否有数据
    /// </summary>
    public bool HasData { get; set; }

    /// <summary>
    /// 最后更新时间
    /// </summary>
    public string? LastUpdated { get; set; }

    /// <summary>
    /// 设备 ID
    /// </summary>
    public string? DeviceId { get; set; }

    /// <summary>
    /// 数据版本
    /// </summary>
    public int? Version { get; set; }
}

/// <summary>
/// 配置响应
/// </summary>
public class ConfigResponse
{
    /// <summary>
    /// 加密数据包
    /// </summary>
    public required EncryptedPackage Data { get; set; }
}

/// <summary>
/// 推送请求
/// </summary>
public class PushRequest
{
    /// <summary>
    /// 加密数据包
    /// </summary>
    public required EncryptedPackage Data { get; set; }
}

/// <summary>
/// 推送响应
/// </summary>
public class PushResponse
{
    /// <summary>
    /// 是否成功
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// 时间戳
    /// </summary>
    public required string Timestamp { get; set; }
}

/// <summary>
/// 认证响应
/// </summary>
public class AuthResponse
{
    /// <summary>
    /// 是否成功
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// 消息
    /// </summary>
    public string? Message { get; set; }
}

/// <summary>
/// 错误响应
/// </summary>
public class ErrorResponse
{
    /// <summary>
    /// 错误消息
    /// </summary>
    public required string Error { get; set; }
}
