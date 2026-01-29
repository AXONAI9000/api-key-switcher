# API Key Switcher

一个用于管理和切换多个 AI 服务商 API Key 的桌面工具。

## 功能特性

- **完全离线使用** - 无需服务端，开箱即用
- 支持多个 AI 服务商 (Claude, OpenAI, Gemini, DeepSeek)
- 图形界面 + 命令行双模式
- 系统托盘快速切换
- 导入/导出配置备份
- 跨设备同步（可选，支持自建服务器、GitHub Gist、WebDAV）
- 端到端加密（AES-256-GCM）

## 下载

| 平台 | 下载链接 |
|------|----------|
| Windows | [API-Key-Switcher.exe](https://github.com/AXONAI9000/AI9000/releases/download/api-key-switcher-latest/API-Key-Switcher.exe) |

## 项目结构

```
├── client/              # Electron 桌面客户端
│   ├── src/
│   │   ├── cli/         # 命令行工具
│   │   ├── main/        # Electron 主进程
│   │   ├── renderer/    # React UI
│   │   └── shared/      # 共享代码
│   └── package.json
│
└── server/              # 同步服务器
    ├── src/             # .NET 10 源码
    └── docker-compose.yml
```

## 快速开始

### 客户端

```bash
cd client
npm install
npm run dev
```

### 同步服务器（可选）

```bash
cd server
export SYNC_TOKEN="your-secure-token"
docker-compose up -d
```

## 文档

- [客户端详细文档](client/README.md)
- [服务器 API 文档](server/README.md)
- [同步功能使用指南](docs/sync-guide.md)
- [安全说明](docs/security.md)

## License

MIT
