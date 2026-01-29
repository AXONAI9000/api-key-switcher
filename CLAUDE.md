# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

API Key Switcher 是一个用于管理和切换多个 AI 服务商 API Key 的桌面工具，包含：
- **client**: Electron 桌面客户端，支持 GUI 和 CLI 双模式
- **server**: .NET 10 同步服务器，支持端到端加密的配置同步

## Build Commands

### Client (Electron)

```bash
cd client

# Development
npm run dev              # Start full dev environment
npm run dev:main         # Main process only
npm run dev:renderer     # Renderer process only

# Build
npm run build            # Build application
npm run build:cli        # Build CLI tool

# Package
npm run package          # Package for distribution

# Test
npm test                 # Run tests
npm run test:watch       # Watch mode
```

### Server (.NET)

```bash
cd server/src

# Development
dotnet restore
dotnet build
dotnet run               # Runs on port 5000

# Production
dotnet publish -c Release -o ../publish

# Docker
docker-compose up -d     # Requires SYNC_TOKEN env var
```

## Architecture

### Client

```
client/src/
├── cli/           # Commander.js CLI entry point
├── main/          # Electron main process
├── renderer/      # React UI with TailwindCSS
│   └── components/
│       └── sync/  # Sync feature components (auth, backends)
└── shared/        # Shared code between processes
    ├── config-manager.ts  # Core config management
    └── sync/              # Sync functionality
        ├── crypto.ts      # AES-256-GCM encryption
        └── backends/      # Server, Gist, WebDAV backends
```

Key concepts:
- Config stored at `~/.api-key-switcher/config.json`
- Environment variables set via Windows registry (`HKCU\Environment`) or Unix shell config
- End-to-end encryption with PBKDF2 key derivation (100k iterations)
- Supports providers: Claude, OpenAI, Gemini, DeepSeek, Custom

### Server

```
server/src/
├── Controllers/   # Auth, Health, Sync endpoints
├── Services/      # Business logic (Auth, JWT, Sync)
├── Models/        # Data models
├── Data/          # EF Core SQLite context
└── Middleware/    # JWT authentication
```

API endpoints:
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login (returns JWT)
- `GET/PUT /api/v1/sync/config` - Download/upload encrypted config
- `GET /health` - Health check

## CI/CD

GitHub Actions workflow (`.github/workflows/api-key-switcher.yml`):
- Triggers on push to master (client/**) or version tags
- Builds and packages Windows executable
- Publishes to GitHub Releases (tag `latest` for dev, `v*.*.*` for releases)
