# 版本发布脚本 (PowerShell)

$ErrorActionPreference = "Stop"

Write-Host "=== API Key Switcher 版本发布工具 ===" -ForegroundColor Green
Write-Host ""

# 获取当前版本
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$currentVersion = $packageJson.version
Write-Host "当前版本: v$currentVersion" -ForegroundColor Yellow
Write-Host ""

# 询问新版本号
$newVersion = Read-Host "请输入新版本号 (例如: 1.0.1, 1.1.0, 2.0.0)"

# 验证版本号格式
if ($newVersion -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "错误: 版本号格式不正确，应为 x.y.z" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "准备发布版本: v$newVersion" -ForegroundColor Yellow
Write-Host "这将执行以下操作:"
Write-Host "  1. 更新 package.json 中的版本号"
Write-Host "  2. 提交更改"
Write-Host "  3. 创建 Git 标签 v$newVersion"
Write-Host "  4. 推送到远程仓库"
Write-Host "  5. GitHub Actions 将自动构建并创建 Release"
Write-Host ""

$confirm = Read-Host "确认继续? (y/n)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "已取消" -ForegroundColor Red
    exit 1
}

try {
    # 更新 package.json 版本号
    Write-Host ""
    Write-Host "[1/4] 更新版本号..." -ForegroundColor Green
    npm version $newVersion --no-git-tag-version

    # 提交更改
    Write-Host "[2/4] 提交更改..." -ForegroundColor Green
    git add package.json package-lock.json
    git commit -m "chore: bump version to $newVersion"

    # 创建标签
    Write-Host "[3/4] 创建标签 v$newVersion..." -ForegroundColor Green
    git tag -a "v$newVersion" -m "Release version $newVersion"

    # 推送
    Write-Host "[4/4] 推送到远程仓库..." -ForegroundColor Green
    git push origin master
    git push origin "v$newVersion"

    Write-Host ""
    Write-Host "✓ 发布成功!" -ForegroundColor Green
    
    # 获取仓库 URL
    $remoteUrl = git config --get remote.origin.url
    $repoPath = $remoteUrl -replace '.*github\.com[:/](.*)\.git', '$1'
    
    Write-Host "GitHub Actions 正在构建，请访问以下链接查看进度:" -ForegroundColor Yellow
    Write-Host "https://github.com/$repoPath/actions"
    Write-Host ""
    Write-Host "构建完成后，Release 将自动创建在:" -ForegroundColor Yellow
    Write-Host "https://github.com/$repoPath/releases"
}
catch {
    Write-Host ""
    Write-Host "发布失败: $_" -ForegroundColor Red
    exit 1
}
