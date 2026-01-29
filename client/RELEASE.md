# 版本发布指南

## 自动化发布流程说明

本项目已配置自动化发布流程，支持两种发布方式：

### 1. 开发版本（Latest）
- **触发方式**: 推送代码到 `main` 分支
- **标签**: `latest`
- **特点**: 
  - 自动构建并更新 `latest` Release
  - 标记为预发布版本（Pre-release）
  - 适合日常开发测试
  - 每次推送都会覆盖上一个 latest 版本

### 2. 正式版本
- **触发方式**: 创建版本标签（如 `v1.0.0`）
- **标签**: `v1.0.0`, `v1.0.1`, `v1.1.0` 等
- **特点**:
  - 创建独立的 Release，永久保留
  - 标记为正式版本
  - 适合生产环境使用
  - 所有历史版本都会保留

## 快速发布新版本

### 方法一：使用发布脚本（推荐）

**Windows 用户：**
```powershell
cd tools/api-key-switcher
.\release.ps1
```

**Linux/Mac 用户：**
```bash
cd tools/api-key-switcher
chmod +x release.sh
./release.sh
```

脚本会自动：
1. 提示输入新版本号
2. 更新 `package.json`
3. 创建 Git 提交和标签
4. 推送到远程仓库
5. 触发 GitHub Actions 自动构建

### 方法二：手动发布

1. **更新版本号**
   ```bash
   cd tools/api-key-switcher
   npm version 1.0.1  # 或 1.1.0, 2.0.0 等
   ```

2. **推送标签**
   ```bash
   git push origin master
   git push origin v1.0.1
   ```

3. **等待自动构建**
   - 访问 GitHub Actions 查看构建进度
   - 构建完成后会自动创建 Release

## 版本号规范

使用语义化版本号（Semantic Versioning）：

- **主版本号 (Major)**: 不兼容的 API 修改
  - 例如: `1.0.0` → `2.0.0`
  
- **次版本号 (Minor)**: 向下兼容的功能性新增
  - 例如: `1.0.0` → `1.1.0`
  
- **修订号 (Patch)**: 向下兼容的问题修正
  - 例如: `1.0.0` → `1.0.1`

## Release 内容

### 开发版本 (latest)
自动生成的内容包括：
- 版本号（带 dev 后缀）
- 构建时间
- 提交 SHA
- 提交信息

### 正式版本
自动生成的内容包括：
- 版本号
- 下载说明
- 更新内容模板（需要手动编辑）

**发布后建议：**
1. 访问 GitHub Releases 页面
2. 编辑新创建的 Release
3. 填写详细的更新说明

## 常见问题

### Q: 如何删除错误的标签？
```bash
# 删除本地标签
git tag -d v1.0.0

# 删除远程标签
git push origin :refs/tags/v1.0.0
```

### Q: 如何修改已发布的 Release？
1. 访问 GitHub Releases 页面
2. 点击对应版本的 "Edit" 按钮
3. 修改标题、说明或附件
4. 保存更改

### Q: 构建失败怎么办？
1. 访问 GitHub Actions 查看错误日志
2. 修复问题后重新推送
3. 或者删除标签后重新创建

### Q: 如何回滚版本？
1. 在 GitHub Releases 找到旧版本
2. 下载对应的构建文件
3. 或者创建新的修复版本

## 工作流文件

配置文件位置: `.github/workflows/api-key-switcher.yml`

主要功能：
- 自动检测版本类型（开发版/正式版）
- 构建 Windows 可执行文件
- 上传构建产物
- 创建或更新 GitHub Release
