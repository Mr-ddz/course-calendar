# 阿里云 Codeup + 云效流水线 一键发布（方案 B：服务器端构建）

> 背景：国内访问 GitHub 不稳定，代码仓库迁移到阿里云 Codeup（已导入），发布链路也迁移到云效流水线，
> 全程阿里云内网络，摆脱对 GitHub 的依赖。本方案为**服务器端构建**：流水线只负责 SSH 到服务器执行部署脚本。

## 部署架构

```
本地开发 ──push──▶ Codeup 仓库 ──▶ 云效流水线（手动点「运行」按钮）
                                      │  SSH 执行
                                      ▼
                               /root/course-calendar（git clone 部署目录）
                                git pull → 前端构建 → 后端装依赖 → pm2 restart
                                      │
                              数据库：复用 /root/backend/data/schedule.db（DB_DIR 指向，git pull 永不触碰）
```

## 一、本地准备（本次已就绪）

| 文件/操作 | 说明 |
|---|---|
| `scripts/deploy.sh` | 每次发布执行的部署脚本（流水线 SSH 任务调用） |
| `scripts/setup-server.sh` | 服务器一次性改造脚本 |
| `docs/codeup-deploy.md` | 本手册 |
| `git remote add codeup` | 本地已添加 Codeup 远端（`git push codeup main` 上传） |

## 二、服务器一次性改造（只需一次，约 10 分钟）

1. 把 `scripts/setup-server.sh` 上传到服务器（`scp scripts/setup-server.sh root@服务器IP:/root/`），
   或直接在服务器上 `vim /root/setup-server.sh` 粘贴内容。
2. **在服务器交互式终端中执行**（git clone 首次需要输入 Codeup 凭据，不能后台运行）：
   ```bash
   bash /root/setup-server.sh https://ddz-cn-beijing.devops.aliyuncs.com/codeup/Mr-ddz/course-calendar.git
   ```
3. 首次 git clone 时提示输入 **Codeup 用户名 + 访问令牌**（在 Codeup → 个人设置 → 访问令牌 里生成），
   输入一次后自动保存，后续 `git pull` 免输。
4. 脚本会完成：npm 镜像 → 克隆 → 构建验证 → 复用现有数据库 → 切换 pm2。
5. 验证：
   ```bash
   curl http://localhost:3002/api/holidays/2026   # 正常返回 JSON
   pm2 status                                       # course-calendar 为 online
   ```
6. **验收重点**：登录页面，确认原有课程、学生、教师数据都在（数据库是复用同一文件，应当完好）。

> 回滚：如异常，执行 `cd /root/backend && DB_DIR=/root/backend/data pm2 start server.js --name course-calendar && pm2 save`。
> 旧目录 `/root/backend` 全程未删除，作为兜底。

## 三、云效流水线配置（在阿里云控制台操作）

1. 打开 Codeup 仓库页 → 顶部「**流水线**」标签 → 新建流水线（或 云效控制台 → 流水线 → 新建）。
2. 流水线源：选择 **Codeup** → 仓库 `course-calendar` → 分支 `main`。
3. **触发设置**：只保留「手动运行」，关闭代码提交自动触发。
4. 新建阶段 → 添加任务 → 选「**SSH 命令执行**」（或「主机部署」+ Shell 命令）。
5. 配置主机连接（首次会引导）：
   | 项 | 值 |
   |---|---|
   | 主机 IP | 你的服务器公网 IP |
   | 端口 | 22 |
   | 认证 | SSH 密钥 或 root 密码（建议密钥） |
   | 执行用户 | root（脚本路径与 pm2 均按 root 设计） |
6. 任务执行命令：
   ```bash
   bash /root/course-calendar/scripts/deploy.sh
   ```
7. 保存。以后在流水线页点「**运行**」→ 选 main → 运行，即完成一次发布。

## 四、日常发布流程（一键）

```bash
# 本地提交并推送到 Codeup
git push codeup main
```
然后在 Codeup 仓库页 → 流水线 → 点「运行」。或直接在服务器上手动发布：
```bash
bash /root/course-calendar/scripts/deploy.sh
```

## 五、常见问题

- **npm install 慢**：setup-server.sh 已配置 npmmirror 镜像；若仍慢，检查 `npm config get registry`。
- **git pull 失败（本地有改动）**：服务器部署目录不要手动改文件；若有残留改动，`cd /root/course-calendar && git reset --hard origin/main` 后重试。
- **pm2 重启后数据库环境变量丢失**：不要用 `pm2 restart --update-env`（会用当前 shell 环境覆盖，丢失 DB_DIR）；直接用 `pm2 restart course-calendar`。
- **Nginx 反代**：Nginx 只反代端口 3002，与代码路径无关，无需修改。
- **服务器用户名不是 root**：所有路径、pm2、脚本均按 root 编写；若用其他用户，需相应调整 APP_DIR 与 sudo。

## 六、迁移前后的对应关系（对照原 GitHub 工作流）

| 原 GitHub Actions（deploy.yml） | 现在的云效流水线 |
|---|---|
| `workflow_dispatch` 手动触发 | 手动点「运行」 |
| actions/checkout | 流水线源 = Codeup 仓库 |
| 云上 `npm run build` 构建前端 | 服务器端 deploy.sh 构建 |
| scp 上传到 /root | git pull 同步（自动处理文件删除） |
| ssh `npm install && pm2 restart` | deploy.sh 中执行 |
| secrets（HOST/KEY） | 云效主机组 SSH 认证 |
