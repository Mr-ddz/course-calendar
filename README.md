# 📚 课程表

教师上课课程表管理工具，支持多教师登录、数据隔离、分钟级课程安排。

## 技术栈

- **前端**: Vue 3 + Element Plus + Axios + Vite
- **后端**: Node.js + Express + SQLite3

## 本地运行

```bash
# 1. 构建前端
cd frontend
npm install
npm run build
cd ..

# 2. 启动后端（同时提供页面和 API）
cd backend
npm install
node server.js
```

浏览器打开 **http://localhost:3002**

## 部署到服务器

详见 [DEPLOY.md](DEPLOY.md)

## 教师管理

```bash
cd backend
node seed.js list                            # 查看所有教师
node seed.js add "姓名" "用户名" "密码"       # 添加教师
node seed.js delete <id>                      # 删除教师
node seed.js reset-password "用户名" "新密码"  # 重置密码
```
