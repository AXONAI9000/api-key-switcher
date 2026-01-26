# API Key Sync Server

API Key Switcher 的同步服务器，用于跨设备同步加密的 API Key 配置。

## 特性

- 零知识存储：服务器只存储加密数据，无法解密
- 轻量级：基于 .NET 10，资源占用低
- Docker 一键部署
- RESTful API
- Swagger 文档支持

## 快速开始

### 使用 Docker Compose（推荐）

1. 设置访问令牌：

```bash
export SYNC_TOKEN="your-secure-token-here"
```

2. 启动服务：

```bash
docker-compose up -d
```

3. 验证服务运行：

```bash
curl http://localhost:5000/health
```

### 手动构建

```bash
cd src
dotnet restore
dotnet build
dotnet run
```

### 发布生产版本

```bash
cd src
dotnet publish -c Release -o ../publish
```

## API 文档

### 认证

所有 `/api/v1/sync/*` 端点需要在请求头中携带 Bearer Token：

```
Authorization: Bearer your-secure-token-here
```

可选请求头：

| 请求头 | 描述 |
|--------|------|
| `X-Device-Id` | 设备标识符，用于追踪同步来源 |

### 端点概览

| 方法 | 路径 | 认证 | 描述 |
|------|------|------|------|
| GET | `/health` | 否 | 健康检查 |
| GET | `/api/v1/sync/status` | 是 | 获取同步状态 |
| GET | `/api/v1/sync/config` | 是 | 下载加密配置 |
| PUT | `/api/v1/sync/config` | 是 | 上传加密配置 |
| POST | `/api/v1/sync/auth` | 是 | 验证访问令牌 |

---

### GET /health

健康检查端点，用于监控服务状态。

**请求示例：**

```bash
curl http://localhost:5000/health
```

**响应示例：**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.0000000Z",
  "version": "1.0.0"
}
```

---

### POST /api/v1/sync/auth

验证访问令牌是否有效。

**请求示例：**

```bash
curl -X POST http://localhost:5000/api/v1/sync/auth \
  -H "Authorization: Bearer your-token"
```

**成功响应 (200)：**

```json
{
  "success": true,
  "message": "Token is valid"
}
```

**失败响应 (401)：**

```json
{
  "error": "Invalid token"
}
```

---

### GET /api/v1/sync/status

获取当前用户的同步状态。

**请求示例：**

```bash
curl http://localhost:5000/api/v1/sync/status \
  -H "Authorization: Bearer your-token"
```

**响应示例：**

```json
{
  "connected": true,
  "hasData": true,
  "lastUpdated": "2024-01-15T10:30:00.0000000Z",
  "deviceId": "device-uuid-123",
  "version": 1
}
```

**响应字段说明：**

| 字段 | 类型 | 描述 |
|------|------|------|
| `connected` | boolean | 服务器连接状态，始终为 true |
| `hasData` | boolean | 是否存在已同步的配置数据 |
| `lastUpdated` | string | 最后更新时间（ISO 8601 格式） |
| `deviceId` | string | 最后同步的设备 ID |
| `version` | number | 数据格式版本号 |

---

### GET /api/v1/sync/config

下载加密的配置数据。

**请求示例：**

```bash
curl http://localhost:5000/api/v1/sync/config \
  -H "Authorization: Bearer your-token"
```

**成功响应 (200)：**

```json
{
  "data": {
    "encryptedData": "base64-encoded-encrypted-data",
    "iv": "base64-encoded-iv",
    "salt": "base64-encoded-salt",
    "checksum": "sha256-checksum",
    "version": 1,
    "timestamp": "2024-01-15T10:30:00.0000000Z",
    "deviceId": "device-uuid-123"
  }
}
```

**无数据响应 (404)：**

```json
{
  "error": "No configuration found"
}
```

---

### PUT /api/v1/sync/config

上传加密的配置数据。

**请求示例：**

```bash
curl -X PUT http://localhost:5000/api/v1/sync/config \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: device-uuid-123" \
  -d '{
    "data": {
      "encryptedData": "base64-encoded-encrypted-data",
      "iv": "base64-encoded-iv",
      "salt": "base64-encoded-salt",
      "checksum": "sha256-checksum",
      "version": 1,
      "timestamp": "2024-01-15T10:30:00.0000000Z",
      "deviceId": "device-uuid-123"
    }
  }'
```

**请求体字段说明：**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `data.encryptedData` | string | 是 | Base64 编码的 AES-256-GCM 加密数据 |
| `data.iv` | string | 是 | Base64 编码的初始化向量 (12 bytes) |
| `data.salt` | string | 是 | Base64 编码的密钥派生盐值 (16 bytes) |
| `data.checksum` | string | 是 | 原始数据的 SHA-256 校验和 |
| `data.version` | number | 否 | 数据格式版本号，默认 1 |
| `data.timestamp` | string | 是 | ISO 8601 格式的时间戳 |
| `data.deviceId` | string | 是 | 上传设备的唯一标识符 |

**成功响应 (200)：**

```json
{
  "success": true,
  "timestamp": "2024-01-15T10:30:00.0000000Z"
}
```

**请求无效响应 (400)：**

```json
{
  "error": "Invalid encrypted package"
}
```

---

## 错误码

| HTTP 状态码 | 错误类型 | 描述 |
|-------------|----------|------|
| 200 | - | 请求成功 |
| 400 | Bad Request | 请求体格式错误或缺少必填字段 |
| 401 | Unauthorized | 缺少或无效的 Authorization 头 |
| 404 | Not Found | 请求的资源不存在 |
| 500 | Internal Server Error | 服务器内部错误 |

**错误响应格式：**

```json
{
  "error": "错误描述信息"
}
```

## 配置

### 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `PORT` | 服务监听端口 | `5000` |
| `ASPNETCORE_ENVIRONMENT` | 运行环境 (Development/Production) | `Production` |
| `DataDirectory` | 数据存储目录 | `./data` |
| `DefaultToken` | 默认访问令牌（单用户模式） | - |
| `ValidTokens__0`, `ValidTokens__1`, ... | 有效令牌列表（多用户模式） | - |

### appsettings.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "DataDirectory": "./data",
  "DefaultToken": "your-secure-token-here",
  "ValidTokens": ["token1", "token2", "token3"]
}
```

### 令牌配置说明

服务器支持两种令牌配置方式：

1. **单用户模式**：设置 `DefaultToken`，适合个人使用
2. **多用户模式**：设置 `ValidTokens` 数组，每个令牌对应独立的数据存储

## 安全说明

### 端到端加密

所有配置数据在客户端使用 AES-256-GCM 加密后才上传：

1. 用户输入同步密码
2. 使用 PBKDF2 从密码派生加密密钥
3. 使用 AES-256-GCM 加密配置数据
4. 计算原始数据的 SHA-256 校验和
5. 上传加密数据包到服务器

服务器只存储加密后的数据，无法解密或查看原始内容。

### 访问控制

- 使用 Bearer Token 认证
- 建议使用至少 32 字符的强随机令牌
- 每个令牌的数据相互隔离

### 生产环境建议

1. **启用 HTTPS**：配置反向代理（Nginx/Caddy）启用 TLS
2. **限制访问**：配置防火墙只允许必要的 IP 访问
3. **定期备份**：备份 `DataDirectory` 目录
4. **日志监控**：监控认证失败日志，防止暴力破解

## 数据存储

配置数据以 JSON 文件形式存储：

- 存储位置：`DataDirectory` 目录
- 文件命名：Token 的 SHA-256 哈希值 + `.json`
- 每个令牌对应一个独立文件

**存储文件示例：**

```
data/
├── a1b2c3d4e5f6...abc123.json  # Token A 的数据
└── f6e5d4c3b2a1...def456.json  # Token B 的数据
```

## 开发

### 环境要求

- .NET 10 SDK
- Docker（可选，用于容器化部署）

### Swagger UI

开发模式下可访问 Swagger UI 进行 API 测试：

```
http://localhost:5000/swagger
```

启用开发模式：

```bash
export ASPNETCORE_ENVIRONMENT=Development
dotnet run
```

### 项目结构

```
api-key-sync-server/
├── src/
│   ├── Controllers/
│   │   ├── HealthController.cs   # 健康检查端点
│   │   └── SyncController.cs     # 同步 API 端点
│   ├── Services/
│   │   ├── ISyncService.cs       # 同步服务接口
│   │   └── SyncService.cs        # 同步服务实现
│   ├── Models/
│   │   └── SyncModels.cs         # 数据模型定义
│   ├── Middleware/
│   │   └── TokenAuthMiddleware.cs # Token 认证中间件
│   ├── Program.cs                # 程序入口
│   └── ApiKeySyncServer.csproj   # 项目文件
├── Dockerfile                    # Docker 构建文件
├── docker-compose.yml            # Docker Compose 配置
└── README.md                     # 项目文档
```

### 本地调试

```bash
# 设置开发环境
export ASPNETCORE_ENVIRONMENT=Development
export DefaultToken=dev-token-123

# 运行服务
cd src
dotnet watch run
```

### 运行测试

```bash
# 测试健康检查
curl http://localhost:5000/health

# 测试认证
curl -X POST http://localhost:5000/api/v1/sync/auth \
  -H "Authorization: Bearer dev-token-123"

# 测试获取状态
curl http://localhost:5000/api/v1/sync/status \
  -H "Authorization: Bearer dev-token-123"
```

## Docker 部署

### 构建镜像

```bash
docker build -t api-key-sync-server .
```

### 运行容器

```bash
docker run -d \
  --name api-key-sync-server \
  -p 5000:5000 \
  -v $(pwd)/data:/app/data \
  -e DefaultToken=your-secure-token \
  api-key-sync-server
```

### Docker Compose

```yaml
version: '3.8'
services:
  api-key-sync-server:
    build: .
    ports:
      - "5000:5000"
    volumes:
      - ./data:/app/data
    environment:
      - DefaultToken=${SYNC_TOKEN}
      - ASPNETCORE_ENVIRONMENT=Production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
```

## Nginx 反向代理配置

```nginx
server {
    listen 443 ssl http2;
    server_name sync.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## License

MIT
