#!/usr/bin/env bash
# 一键发布脚本：服务器端执行（云效流水线 SSH 任务调用，也可手动运行）
# 流程：拉取最新代码（develop 分支）→ 前端构建 → 后端装依赖 → 重启服务
# 说明：数据库通过 DB_DIR 环境变量指向 /root/backend/data，git pull 不会触碰，天然安全
set -euo pipefail

APP_DIR=/root/course-calendar

cd "$APP_DIR"
echo "==> 拉取最新代码"
git pull origin develop

echo "==> 前端构建"
cd frontend
npm install
npm run build
cd ..

echo "==> 后端依赖"
cd backend
npm install
cd ..

echo "==> 重启服务"
pm2 restart course-calendar

echo "✅ 发布完成：$(date '+%Y-%m-%d %H:%M:%S')"
