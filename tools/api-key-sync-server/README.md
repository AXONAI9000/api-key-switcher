# API Key Sync Server

API Key Switcher 的同步服务器，用于跨设备同步加密的 API Key 配置。

## 特性

- 🔐 零知识存储：服务器只存储加密数据，无法解密
- 🚀 轻量级：基于 .NET 9，资源占用低
- 🐳 Docker 一键部署
- 📡 RESTful API

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
dotnet run
```

## API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/v1/sync/status` | 获取同步状态 |
| GET | `/api/v1/sync/config` | 下载加密配置 |
| PUT | `/api/v1/sync/config` | 上传加密配置 |
| POST | `/api/v1/sync/auth` | 验证访问令牌 |

## 认证

所有 `/api/v1/sync/*` 端点需要在请求头中携带 Bearer Token：

```
Authorization: Bearer your-secure-token-here
```

## 配置

### 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `5000` |
| `DataDirectory` | 数据存储目录 | `./data` |
| `DefaultToken` | 默认访问令牌 | - |
| `ValidTokens` | 有效令牌列表（JSON 数组） | `[]` |

### appsettings.json

```json
{
  "DataDirectory": "./data",
  "DefaultToken": "your-secure-token-here",
  "ValidTokens": ["token1", "token2"]
}
```

## 安全说明

1. **数据加密**：所有配置数据在客户端使用 AES-256-GCM 加密后才上传，服务器无法解密
2. **访问控制**：使用 Bearer Token 认证，建议使用强随机令牌
3. **HTTPS**：生产环境建议配置反向代理（如 Nginx）启用 HTTPS

## 数据存储

配置数据以 JSON 文件形式存储在 `DataDirectory` 目录下，文件名为 Token 的 SHA-256 哈希值。

## 开发

### Swagger UI

开发模式下可访问 Swagger UI：

```
http://localhost:5000/swagger
```

### 项目结构

```
api-key-sync-server/
├── src/
│   ├── Controllers/      # API 控制器
│   ├── Services/         # 业务服务
│   ├── Models/           # 数据模型
│   ├── Middleware/       # 中间件
│   ├── Program.cs        # 程序入口
│   └── appsettings.json  # 配置文件
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## License

MIT
