# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

API Key Switcher 是一个用于管理和切换多个 AI 服务商 API Key 的桌面工具，包含：
- **client**: Electron 桌面客户端（GUI + CLI 双模式），TypeScript + React + TailwindCSS
- **server**: .NET 10 同步服务器，SQLite + JWT 认证 + 端到端加密配置同步

## Build & Test Commands

### Client (Electron)

```bash
cd client
npm install

# Development
npm run dev                # Full dev environment (main + renderer)
npm run dev:main           # Main process only
npm run dev:renderer       # Renderer process only (Vite, port 5173)

# Build
npm run build              # Build main + renderer
npm run build:main         # Main process only (→ dist/main/)
npm run build:renderer     # Renderer only (→ dist/renderer/)
npm run build:cli          # CLI tool (→ dist/cli/)

# Package
npm run package            # electron-builder → release/API-Key-Switcher.exe

# Test (Vitest)
npm test                   # Run all tests once
npm test -- tests/config-manager.test.ts   # Run single test file
npm run test:watch         # Watch mode
```

### Server (.NET 10)

```bash
cd server/src
dotnet restore
dotnet build
dotnet run                 # Runs on port 5000 (or PORT env var)

# Tests (xUnit)
cd server/tests
dotnet test                # Run all server tests

# Production
cd server/src
dotnet publish -c Release -o ../publish
```

## Architecture

### Client Process Model

Electron 三进程架构，通过 IPC 通信：

```
┌─────────────┐    IPC (preload.ts)    ┌──────────────┐
│  Renderer    │ ◄────────────────────► │  Main Process │
│  (React UI)  │   window.electronAPI   │  (index.ts)   │
└─────────────┘                        └──────┬───────┘
                                              │
                                       ┌──────▼───────┐
                                       │  Shared Layer │
                                       │  config-manager│
                                       │  config-cache  │
                                       │  usage-tracker │
                                       │  key-validator │
                                       │  sync/         │
                                       └──────────────┘
```

- **Renderer → Main**: 通过 `window.electronAPI.xxx()` 调用，映射到 `ipcMain.handle()`
- **IPC 通道定义**: `client/src/shared/types.ts` 中的 `IPC_CHANNELS` 常量
- **Preload 桥接**: `client/src/main/preload.ts` 暴露安全的 API 到渲染进程

### Client Key Modules

| 模块 | 路径 | 职责 |
|------|------|------|
| config-manager | `shared/config-manager.ts` | 配置 CRUD、Key 切换、环境变量设置 |
| config-cache | `shared/config-cache.ts` | 内存缓存 + 1s 延迟写入，减少磁盘 I/O |
| key-validator | `shared/key-validator.ts` | 各服务商 API Key 有效性验证 |
| usage-tracker | `shared/usage-tracker.ts` | Key 切换统计、过期检测 |
| errors | `shared/errors.ts` | 统一错误类型层级 |
| logger | `shared/logger.ts` | 日志系统，敏感信息自动脱敏 |
| sync/ | `shared/sync/` | 同步功能（加密、后端、管理器） |

### Config Flow

```
loadConfig() → ConfigCache.get() → 内存缓存（命中）或 磁盘读取
saveConfig() → ConfigCache.set() → 内存更新 → 1s 后自动 flush 到磁盘（带备份）
```

配置文件: `~/.api-key-switcher/config.json`

### Environment Variable Setting

- **Windows**: `reg add "HKCU\Environment"` 写注册表 + `setx` 广播变更
- **Unix**: 写入 `~/.bashrc` 的 `export` 语句

### Sync Architecture

三种后端（`shared/sync/backends/`）：Server（自建）、Gist（GitHub）、WebDAV

加密: AES-256-GCM，PBKDF2 密钥派生（100k 迭代），随机 IV + Salt

```
本地配置 → encryptConfig() → EncryptedPackage → backend.push() → 远程存储
远程存储 → backend.pull() → EncryptedPackage → decryptConfig() → 本地配置
```

冲突检测基于 SHA-256 校验和 + 时间戳比较，支持 local/remote/merge 三种解决策略。

### Server

ASP.NET Core Web API + SQLite + JWT：

- `Controllers/` → Auth（注册/登录/刷新/登出）、Sync（上传/下载配置）、Health
- `Services/` → AuthService（BCrypt 密码哈希）、JwtService、SyncService（文件存储）
- `Data/AppDbContext.cs` → EF Core SQLite，Users + RefreshTokens 表
- 速率限制: 登录 5次/分钟，注册 3次/小时

### Supported Providers

| Provider | API Key 环境变量 | Base URL 环境变量 |
|----------|-----------------|-------------------|
| Claude | `ANTHROPIC_AUTH_TOKEN` | `ANTHROPIC_BASE_URL` |
| OpenAI | `OPENAI_API_KEY` | `OPENAI_BASE_URL` |
| Gemini | `GOOGLE_API_KEY` | `GOOGLE_API_BASE_URL` |
| DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK_BASE_URL` |
| Custom | `CUSTOM_API_KEY` | `CUSTOM_BASE_URL` |

## TypeScript Configuration

- 基础 `tsconfig.json`: ES2020, ESNext modules, strict mode
- `tsconfig.main.json`: CommonJS 输出到 `dist/main/`（主进程 + shared）
- `tsconfig.cli.json`: CommonJS 输出到 `dist/cli/`（CLI + shared）
- 渲染进程由 Vite 处理，不需要单独的 tsconfig
- 路径别名: `@shared/*` → `src/shared/*`
- 注意: 根 tsconfig 未设置 `jsx`，`tsc --noEmit` 会报 JSX 错误，这是已知问题，实际构建由 Vite 处理

## CI/CD

GitHub Actions (`.github/workflows/api-key-switcher.yml`):
- 触发: push to master (client/**), version tags `v*.*.*`, PRs
- 环境: Windows Latest, Node.js 20
- 产物: `release/API-Key-Switcher.exe`
- 发布: `latest` 标签（预发布）或 `v*.*.*`（正式发布）
