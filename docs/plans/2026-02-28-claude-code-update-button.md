# Claude Code 更新按钮设计

## 概述

在客户端 Claude 页面的 ProviderPanel 中增加一个"检查更新"按钮，点击后检查 Claude Code 是否有新版本，有则自动执行 npm install -g 更新，无则提示已是最新。

## 数据流

```
点击按钮 → Renderer 调用 window.electronAPI.updateClaudeCode()
         → IPC 到 Main Process
         → Main 执行 `claude --version` 获取本地版本
         → Main 执行 `npm view @anthropic-ai/claude-code version --registry=https://registry.npmmirror.com/` 获取远程版本
         → 比较版本：
           - 相同 → 返回 { needUpdate: false, currentVersion }
           - 不同 → 执行 `npm install -g @anthropic-ai/claude-code --registry=https://registry.npmmirror.com/`
                   → 返回 { needUpdate: true, oldVersion, newVersion }
         → Renderer 根据结果用 Toast 显示消息
```

## 需要修改的文件

1. `client/src/shared/ipc-channels.ts` — 新增 `CLAUDE_UPDATE` 通道
2. `client/src/main/preload.ts` — 暴露 `updateClaudeCode()` 方法
3. `client/src/main/index.ts` — 注册 IPC handler，执行 shell 命令
4. `client/src/renderer/components/ProviderPanel.tsx` — 仅 provider === 'claude' 时渲染更新区块
5. 类型定义文件 — 补充 electronAPI 类型

## UI 设计

更新区块放在 ProviderPanel 底部蓝色提示区域上方，仅 Claude 面板显示。

- 紫色/violet 色系卡片，显示当前版本号
- 按钮状态：`检查更新` → `检查中...` → `更新中...`
- 结果通过 Toast 反馈（已是最新 / 更新成功 / 更新失败）
- 当前版本号在组件挂载时获取

## 版本检查逻辑

1. 执行 `claude --version` 获取本地版本
2. 执行 `npm view @anthropic-ai/claude-code version --registry=https://registry.npmmirror.com/` 获取远程最新版本
3. 比较版本号，不同则执行 `npm install -g @anthropic-ai/claude-code --registry=https://registry.npmmirror.com/`
