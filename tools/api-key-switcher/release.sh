#!/bin/bash
# 版本发布脚本

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== API Key Switcher 版本发布工具 ===${NC}\n"

# 获取当前版本
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "当前版本: ${YELLOW}v$CURRENT_VERSION${NC}\n"

# 询问新版本号
echo "请输入新版本号 (例如: 1.0.1, 1.1.0, 2.0.0)"
read -p "新版本号: " NEW_VERSION

# 验证版本号格式
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}错误: 版本号格式不正确，应为 x.y.z${NC}"
    exit 1
fi

echo -e "\n${YELLOW}准备发布版本: v$NEW_VERSION${NC}"
echo "这将执行以下操作:"
echo "  1. 更新 package.json 中的版本号"
echo "  2. 提交更改"
echo "  3. 创建 Git 标签 v$NEW_VERSION"
echo "  4. 推送到远程仓库"
echo "  5. GitHub Actions 将自动构建并创建 Release"
echo ""

read -p "确认继续? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}已取消${NC}"
    exit 1
fi

# 更新 package.json 版本号
echo -e "\n${GREEN}[1/4] 更新版本号...${NC}"
npm version $NEW_VERSION --no-git-tag-version

# 提交更改
echo -e "${GREEN}[2/4] 提交更改...${NC}"
git add package.json package-lock.json
git commit -m "chore: bump version to $NEW_VERSION"

# 创建标签
echo -e "${GREEN}[3/4] 创建标签 v$NEW_VERSION...${NC}"
git tag -a "v$NEW_VERSION" -m "Release version $NEW_VERSION"

# 推送
echo -e "${GREEN}[4/4] 推送到远程仓库...${NC}"
git push origin master
git push origin "v$NEW_VERSION"

echo -e "\n${GREEN}✓ 发布成功!${NC}"
echo -e "GitHub Actions 正在构建，请访问以下链接查看进度:"
echo -e "${YELLOW}https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions${NC}"
echo -e "\n构建完成后，Release 将自动创建在:"
echo -e "${YELLOW}https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/releases${NC}"
