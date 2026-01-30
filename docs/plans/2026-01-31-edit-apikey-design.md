# API Key 编辑功能设计

## 概述

为客户端添加 API Key 编辑功能，用户可以点击每条记录的编辑按钮来修改 API Key、URL 和别名。

## 需求

- 在 KeyCard 操作按钮区添加编辑按钮
- 点击后弹出模态框进行编辑
- 可编辑字段：API Key、Base URL、别名
- 编辑当前使用的 Key 时，自动更新环境变量

## 设计方案

### 1. 组件改造

将 `AddKeyModal` 重命名为 `KeyFormModal`，支持添加和编辑两种模式：

```typescript
interface KeyFormModalProps {
  mode: 'add' | 'edit';
  provider: ProviderType;
  providerInfo: ProviderInfo;
  onClose: () => void;
  onSubmit: (key: string, alias: string, baseUrl?: string) => void;
  isLoading?: boolean;
  initialData?: {
    key: string;
    alias: string;
    baseUrl?: string;
  };
}
```

UI 变化：
- 标题：添加模式 "添加 xxx Key"，编辑模式 "编辑 xxx Key"
- 按钮：添加模式 "添加"，编辑模式 "保存"
- 编辑模式预填充 initialData

### 2. KeyCard 组件修改

添加 `onEdit` 回调和编辑按钮：

```typescript
interface KeyCardProps {
  apiKey: ApiKey;
  isCurrent: boolean;
  onSwitch: () => void;
  onToggle: () => void;
  onRemove: () => void;
  onEdit: () => void;  // 新增
  // ...
}
```

按钮位置：[使用] [禁用] [编辑] [删除]
按钮样式：btn-secondary，铅笔图标

### 3. 数据流与 IPC

编辑逻辑：
1. 更新配置文件中的数据
2. 如果编辑的是当前使用的 Key，同时更新环境变量

主进程处理：
```typescript
async function handleUpdateKey(provider, originalAlias, newData) {
  // 1. 更新配置文件
  updateConfigFile(provider, originalAlias, newData);

  // 2. 检查是否是当前使用的 Key
  const config = getConfig();
  if (config.providers[provider].currentKey === originalAlias) {
    // 如果别名改了，更新 currentKey
    if (newData.alias !== originalAlias) {
      config.providers[provider].currentKey = newData.alias;
    }
    // 更新环境变量
    setEnvVar(providerEnvVar, newData.key);
    if (newData.baseUrl) {
      setEnvVar(baseUrlEnvVar, newData.baseUrl);
    }
  }
}
```

### 4. 文件改动清单

| 文件 | 改动内容 |
|------|----------|
| `AddKeyModal.tsx` | 重命名为 `KeyFormModal.tsx`，添加 mode 和 initialData props |
| `KeyCard.tsx` | 添加 onEdit prop 和编辑按钮 |
| `ProviderPanel.tsx` | 添加 editingKey 状态，处理编辑逻辑 |
| `preload.ts` | 确认 updateKey API 已暴露 |
| `main.ts` | 实现/完善 key:update IPC 处理逻辑 |

## 状态

- [x] 设计完成
- [x] 实现完成
- [ ] 测试通过
