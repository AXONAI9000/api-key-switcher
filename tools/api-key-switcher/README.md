# API Key Switcher

一个用于管理和切换多个 AI 服务商 API Key 的桌面工具。

## 功能特性

- 支持多个 AI 服务商 (Claude, OpenAI, Gemini, DeepSeek)
- 图形界面 + 命令行双模式
- 系统托盘快速切换
- 导入/导出配置备份

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
