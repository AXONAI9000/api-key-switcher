# API Key Switcher

一个用于管理和切换多个 AI 服务商 API Key 的桌面工具。

## 使用场景

- **配额轮换**：当一个 API Key 的配额用完时，快速切换到另一个 Key 继续使用
- **代理切换**：配合 Base URL 设置，快速切换不同的 API 代理服务
- **成本控制**：分离不同项目的 API Key，便于追踪和控制各项目的 API 使用成本

## 截图

![应用截图](assets/screenshot.png)

## 功能特性

- 支持多个 AI 服务商 (Claude, OpenAI, Gemini, DeepSeek)
- 图形界面 + 命令行双模式
- 系统托盘快速切换
- 导入/导出配置备份
- **跨设备同步**（支持自建服务器、GitHub Gist、WebDAV）
- **端到端加密**（AES-256-GCM）

## 安装

```bash
# 克隆项目
cd api-key-switcher

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 启动应用
npm start

# 打包发布
npm run package
```

## CLI 使用

```bash
# 全局安装后可直接使用
npm link

# 添加 Key
api-key-switcher add claude sk-ant-xxx --alias "主账号"

# 列出所有 Key
api-key-switcher list

# 切换 Key
api-key-switcher switch claude 主账号

# 显示当前 Key
api-key-switcher current

# 输出环境变量设置命令
api-key-switcher env claude

# 导出配置
api-key-switcher export ./backup.json

# 导入配置
api-key-switcher import ./backup.json
```

## 配置文件

配置文件存储在 `~/.api-key-switcher/config.json`

```json
{
  "version": "1.0",
  "providers": {
    "claude": {
      "envVar": "ANTHROPIC_AUTH_TOKEN",
      "currentKey": "主账号",
      "keys": [
        {
          "alias": "主账号",
          "key": "sk-ant-xxx...",
          "enabled": true,
          "createdAt": "2024-01-01T00:00:00Z"
        }
      ]
    }
  }
}
```

## 支持的服务商

| 服务商 | 环境变量 |
|--------|----------|
| Claude (Anthropic) | ANTHROPIC_AUTH_TOKEN |
| OpenAI | OPENAI_API_KEY |
| Gemini (Google) | GOOGLE_API_KEY |
| DeepSeek | DEEPSEEK_API_KEY |

## 技术栈

- Electron
- React + TypeScript
- TailwindCSS
- Commander.js (CLI)

## 开发

```bash
# 主进程开发
npm run dev:main

# 渲染进程开发
npm run dev:renderer

# 同时启动
npm run dev

# CLI 开发
npm run build:cli
npm run cli -- list
```

## 许可证

MIT

## 同步功能

支持跨设备同步 API Key 配置，所有数据端到端加密。

### 支持的同步后端

| 后端 | 说明 |
|------|------|
| 自建服务器 | 完全掌控数据，Docker 一键部署 |
| GitHub Gist | 免费，无需部署服务器 |
| WebDAV | 支持坚果云、Nextcloud 等 |

### 安全特性

- AES-256-GCM 加密
- PBKDF2 密钥派生（100,000 次迭代）
- 零知识存储（服务器无法解密）

详细文档：
- [同步功能使用指南](docs/sync-guide.md)
- [安全说明](docs/security.md)

### 部署同步服务器

```bash
cd ../api-key-sync-server

# 设置访问令牌
export SYNC_TOKEN="your-secure-token"

# 启动服务
docker-compose up -d
```

## 测试

```bash
# 运行测试
npm test

# 监听模式
npm run test:watch
```
