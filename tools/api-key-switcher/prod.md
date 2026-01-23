# API Key Switcher - 产品需求文档 (prod.md)

## 项目概述

**项目名称**: api-key-switcher

**项目定位**: 一个用于管理和切换多个 AI 服务商 API Key 的独立桌面工具

**核心价值**: 当某个 API Key 余额用尽时，用户可以快速切换到其他可用的 Key，避免服务中断

---

## 功能需求

### 1. 多服务商支持
- Claude (Anthropic)
- OpenAI
- Gemini (Google)
- DeepSeek
- 可扩展支持其他服务商

### 2. Key 管理功能
| 功能 | 描述 |
|------|------|
| 添加 Key | 录入新的 API Key，指定服务商和别名 |
| 删除 Key | 移除不再使用的 Key |
| 编辑 Key | 修改 Key 信息（别名等） |
| 启用/禁用 | 临时禁用某个 Key 而不删除 |
| 查看列表 | 显示所有 Key 及其状态 |

### 3. 切换机制
- **切换方式**: 手动切换（用户在界面上点击切换）
- **注入方式**: 环境变量注入（设置 ANTHROPIC_AUTH_TOKEN、OPENAI_API_KEY 等）
- **当前状态**: 显示当前正在使用的 Key

### 4. 界面需求
- Key 列表展示
- 当前使用的 Key 高亮标记
- 各 Key 的启用/禁用状态
- 每个服务商独立管理

---

## 技术方案

### 技术栈
| 层级 | 技术选型 |
|------|----------|
| 桌面框架 | Electron |
| 前端框架 | React + TypeScript |
| 后端 | Node.js + TypeScript |
| 配置存储 | JSON 文件 |
| 样式方案 | TailwindCSS |

### 项目结构
```
api-key-switcher/
├── src/
│   ├── main/           # Electron 主进程
│   ├── renderer/       # React 渲染进程
│   ├── shared/         # 共享类型和工具
│   └── cli/            # CLI 命令
├── assets/             # 图标资源
├── config/             # 默认配置
└── package.json
```

### 配置文件格式
```json
{
  "version": "1.0",
  "providers": {
    "claude": {
      "envVar": "ANTHROPIC_AUTH_TOKEN",
      "currentKey": "key-alias-1",
      "keys": [
        {
          "alias": "key-alias-1",
          "key": "sk-ant-xxx...",
          "enabled": true,
          "createdAt": "2024-01-01T00:00:00Z"
        }
      ]
    },
    "openai": {
      "envVar": "OPENAI_API_KEY",
      "currentKey": null,
      "keys": []
    }
  }
}
```

---

## CLI 命令设计

```bash
# 基础命令
api-key-switcher add <provider> <key> [--alias <name>]  # 添加 Key
api-key-switcher remove <provider> <alias>              # 删除 Key
api-key-switcher list [provider]                        # 列出所有 Key
api-key-switcher switch <provider> <alias>              # 切换到指定 Key
api-key-switcher current [provider]                     # 显示当前 Key

# 启用/禁用
api-key-switcher enable <provider> <alias>              # 启用 Key
api-key-switcher disable <provider> <alias>             # 禁用 Key

# 导入导出
api-key-switcher export <file>                          # 导出配置
api-key-switcher import <file>                          # 导入配置

# 环境变量
api-key-switcher env [provider]                         # 输出设置环境变量的命令
api-key-switcher config                                 # 显示配置文件路径

# 示例
api-key-switcher add claude sk-ant-xxx --alias "主账号"
api-key-switcher switch claude 主账号
api-key-switcher export ./backup.json
```

---

## 系统托盘功能
- 最小化到系统托盘
- 托盘右键菜单：
  - 显示主窗口
  - 快速切换 Key（按服务商分组）
  - 退出程序

## 导入/导出功能
- 导出配置到 JSON 文件
- 从 JSON 文件导入配置
- 支持 CLI 和 GUI 两种方式

---

## 非功能需求

### 安全性
- Key 明文存储于本地 JSON 文件
- 配置文件存储在用户目录下（如 ~/.api-key-switcher/config.json）

### 跨平台
- Windows（主要）
- macOS（未来支持）
- Linux（未来支持）

---

## 总结

| 维度 | 决策 |
|------|------|
| 项目类型 | 独立桌面工具 |
| 界面形式 | Electron + React (GUI) + CLI |
| 开发语言 | TypeScript (前后端统一) |
| 存储方式 | JSON 配置文件（明文） |
| 切换机制 | 手动切换，环境变量注入 |
| 服务商 | 多服务商支持 (Claude, OpenAI, Gemini, DeepSeek 等) |
| 系统托盘 | 支持，含右键菜单快速切换 |
| 导入导出 | 支持 JSON 格式配置备份 |
