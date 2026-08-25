#!/usr/bin/env bash
# 服务器一次性改造脚本：把部署方式从「scp 覆盖 /root/backend」切换为「git clone /root/course-calendar」
# 新服务通过 DB_DIR 环境变量直接复用现有数据库 /root/backend/data/schedule.db（零拷贝、零数据丢失风险）
# 用法（在服务器交互式终端中执行，git clone 首次会提示输入 Codeup 用户名 + 访问令牌）:
#   bash setup-server.sh <Codeup仓库URL>
set -euo pipefail

REPO_URL="${1:?用法: bash setup-server.sh <Codeup仓库URL>}"
APP_DIR=/root/course-calendar
DB_DIR=/root/backend/data   # 现有数据库所在目录（database.js 的 DB_DIR 语义）

echo "====[1/6] npm 国内镜像 ===="
npm config set registry https://registry.npmmirror.com
echo "-> 当前 registry: $(npm config get registry)"

echo "====[2/6] 克隆 Codeup 仓库 ===="
cd /root
if [ -d "$APP_DIR/.git" ]; then
  echo "-> $APP_DIR 已存在，跳过克隆（请自行确认代码为最新）"
else
  git config --global credential.helper store
  git clone "$REPO_URL" "$APP_DIR"   # 首次会提示输入凭据，输入后自动保存，后续 git pull 免输
fi

echo "====[3/6] 构建前端 ===="
cd "$APP_DIR/frontend"
npm install
npm run build

echo "====[4/6] 后端依赖 ===="
cd "$APP_DIR/backend"
npm install

echo "====[5/6] 确认现有数据库 ===="
if [ -f "$DB_DIR/schedule.db" ]; then
  echo "-> 找到 $DB_DIR/schedule.db，新服务将直接复用此库"
else
  echo "❌ 未找到 $DB_DIR/schedule.db，已中止（避免新建空库导致数据丢失）"
  exit 1
fi

echo "====[6/6] 切换 pm2（短暂停机几秒）===="
pm2 delete course-calendar 2>/dev/null || true
cd "$APP_DIR/backend"
DB_DIR="$DB_DIR" pm2 start server.js --name course-calendar
pm2 save

echo ""
echo "🎉 改造完成！请验证："
echo "  curl http://localhost:3002/api/holidays/2026"
echo "  pm2 status   （确认 course-calendar 为 online）"
echo ""
echo "回滚方法（如需要）："
echo "  cd /root/backend && DB_DIR=$DB_DIR pm2 start server.js --name course-calendar && pm2 save"
echo ""
echo "说明：旧目录 /root/backend 保留未动（含数据库），确认稳定后自行整理即可。"
