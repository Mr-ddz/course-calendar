# 📚 教师课程表

一个简洁、美观的教师课程表管理工具，支持分钟级课程安排。

## 技术栈

- **前端**: Vue 3 + Element Plus + Axios + Vite
- **后端**: Node.js + Express + SQLite3

## 快速启动

### 1. 启动后端（端口 3001）

```bash
cd backend
npm start
```

### 2. 启动前端（端口 5173）

```bash
cd frontend
npm run dev
```

### 3. 访问

浏览器打开 **http://localhost:5173/**

## 功能特性

- 📅 **日期切换** — 支持任意日期选择，自动滚动到当前时间
- ⏰ **24小时时间轴** — 以小时为刻度，精确到分钟级别
- ➕ **添加课程** — 点击时间轴空白区域快速添加
- ✏️ **编辑课程** — 点击已有课程进行修改
- 🗑️ **删除课程** — 编辑对话框中可直接删除
- 🎨 **颜色标记** — 不同课程用不同颜色区分
- 📝 **备注信息** — 每门课程可添加文字备注

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/courses?date=YYYY-MM-DD` | 获取指定日期所有课程 |
| GET | `/api/courses/range?start_date=&end_date=` | 获取日期范围课程 |
| POST | `/api/courses` | 创建课程 |
| PUT | `/api/courses/:id` | 更新课程 |
| DELETE | `/api/courses/:id` | 删除课程 |
