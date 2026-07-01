# 📚 上课啦 — 部署上线指南

> 适用于：阿里云 / 腾讯云 / 华为云 等 Linux 服务器

---

## 一、本地准备（在你的电脑上操作）

### 1. 构建前端

```bash
# 在项目根目录 /Users/admin/Desktop/project/calendar 下执行
cd frontend
npm run build
```

构建成功后会生成 `frontend/dist/` 文件夹，里面是编译好的前端页面。

### 2. 测试本地部署模式

```bash
# 停掉之前的前端开发服务器（按 Ctrl+C）
# 只启动后端（它同时提供页面和 API）
cd backend
node server.js
```

浏览器打开 `http://localhost:3002` → 能正常登录使用 → 本地没问题。

---

## 二、购买服务器

### 推荐配置（最低即可）

| 云厂商 | 套餐 | 价格 | 说明 |
|--------|------|------|------|
| **阿里云** | 轻量应用服务器 | ~68元/月 | 2核1G，够用 |
| **腾讯云** | 轻量应用服务器 | ~68元/月 | 同上 |
| **华为云** | HECS 云服务器 | ~56元/月 | 同上 |

操作系统选择 **Ubuntu 24.04** 或 **CentOS 7.9**。

> 💡 学生有优惠：阿里云/腾讯云都有学生专享套餐，认证后低至 9.9元/月

---

## 三、服务器初始化（在你的服务器上操作）

### 1. 连接服务器

```bash
# 在自己电脑的终端执行
ssh root@你的服务器公网IP
```

### 2. 安装 Node.js

```bash
# Ubuntu 系统
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git

# 验证
node -v   # 应该输出 v20.x.x
npm -v    # 应该输出 10.x.x
```

### 3. 安装 PM2（进程守护）

```bash
npm install -g pm2
```

PM2 的作用：关闭终端后程序不中断，程序崩溃后自动重启。

---

## 四、上传代码

### 方式 A：从 GitHub 拉取（推荐）

```bash
# 第一步：在你自己电脑上把代码推送到 GitHub
cd /Users/admin/Desktop/project/calendar

git init
git add -A
git commit -m "init"

# 去 github.com 创建仓库 → 然后：
git remote add origin https://github.com/你的用户名/course-schedule.git
git branch -M main
git push -u origin main

# 第二步：在服务器上拉取
ssh root@你的服务器IP
git clone https://github.com/你的用户名/course-schedule.git
cd course-schedule
```

### 方式 B：直接上传

```bash
# 在你电脑上执行
# 先确定本地项目目录下没有 node_modules 和 .db 文件
cd /Users/admin/Desktop/project/calendar

# 打包（跳过 node_modules 和数据库）
tar --exclude='backend/node_modules' \
    --exclude='frontend/node_modules' \
    --exclude='*.db' \
    -czf course-schedule.tar.gz .

# 上传到服务器
scp course-schedule.tar.gz root@你的服务器IP:/root/

# 在服务器上解压
ssh root@你的服务器IP
tar -xzf course-schedule.tar.gz
cd course-schedule
```

---

## 五、构建 & 启动（在服务器上操作）

```bash
cd /root/course-schedule   # 进入项目目录

# 1. 构建前端
cd frontend
npm install
npm run build
cd ..

# 2. 安装后端依赖
cd backend
npm install
cd ..

# 3. 添加教师账号（默认只有 admin）
cd backend
node seed.js add "张老师" "zhang" "123456"
node seed.js add "李老师" "li" "123456"
# ... 按需添加更多
cd ..
```

### 用 PM2 启动

```bash
# 启动
pm2 start backend/server.js --name course-schedule

# 设置开机自启
pm2 save
pm2 startup
```

### 常用 PM2 命令

```bash
pm2 list                  # 查看运行状态
pm2 logs course-schedule  # 查看实时日志
pm2 restart course-schedule  # 重启
pm2 stop course-schedule     # 停止
```

**现在访问 `http://你的服务器IP:3002` 就能用了！**

---

## 六、绑定域名 + HTTPS（强烈推荐）

### 1. 购买域名

去阿里云/腾讯云买域名，比如 `ketang.com`。

### 2. 解析域名

在你的云厂商控制台 → DNS 解析 → 添加记录：
```
记录类型: A
主机记录: @          (表示 ketang.com)
记录值:   你的服务器IP
```

### 3. 安装 Nginx

```bash
# Ubuntu
apt-get install -y nginx

# 创建配置文件
cat > /etc/nginx/sites-available/course-schedule << 'EOF'
server {
    listen 80;
    server_name 你的域名.com;   # 改成你的域名

    # 解决前端路由刷新 404（很重要！）
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# 启用配置
ln -sf /etc/nginx/sites-available/course-schedule /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试配置
nginx -t

# 重载 Nginx
systemctl reload nginx
```

### 4. 配置 HTTPS（免费）

```bash
# 安装 Certbot
apt-get install -y certbot python3-certbot-nginx

# 获取证书（按提示输入邮箱，同意条款）
certbot --nginx -d 你的域名.com

# 证书会自动续期，测试一下：
certbot renew --dry-run
```

现在访问 `https://你的域名.com` → ✅ 小锁标志，安全连接。

---

## 七、数据备份

SQLite 数据库就是一个文件，备份它就行：

```bash
# 手动备份
cp /root/course-schedule/backend/schedule.db /root/backup/schedule-$(date +%Y%m%d).db

# 设置定时任务（每天凌晨 3 点自动备份）
crontab -e
# 添加这一行：
0 3 * * * cp /root/course-schedule/backend/schedule.db /root/backup/schedule-$(date +\%Y\%m\%d).db
```

恢复数据只需把备份的 `.db` 文件复制回 `backend/` 目录，重启即可。

---

## 八、安全设置（生产环境必做）

```bash
# 1. 修改默认管理员密码
cd /root/course-schedule/backend
node seed.js reset-password "admin" "你的复杂密码"

# 2. 配置服务器防火墙（仅开放必要端口）
# Ubuntu
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS
ufw deny 3002        # 关闭后端直连（只用 Nginx 反向代理）
ufw enable
```

---

## 九、更新代码

当你修改了代码，要更新到服务器：

```bash
# 方式 A：Git（推荐）
# 在你电脑上
cd /Users/admin/Desktop/project/calendar
git add -A
git commit -m "更新内容"
git push

# 在服务器上
cd /root/course-schedule
git pull
cd frontend && npm run build && cd ..
pm2 restart course-schedule

# 方式 B：手动上传
# 在你电脑上重新 tar + scp
# 在服务器上重新解压覆盖
# 记得先备份数据库！
cp /root/course-schedule/backend/schedule.db /tmp/
# 解压覆盖后，把数据库放回去
cp /tmp/schedule.db /root/course-schedule/backend/
```

---

## 十、免费替代方案：Railway

> 适合不想买服务器、个人使用

[railway.app](https://railway.app) — 免费额度够个人用

1. 把代码推到 GitHub
2. 注册 Railway → GitHub 授权
3. New Project → Deploy from GitHub repo
4. 选择你的仓库
5. Railway 自动检测 Node.js → 自动部署

Railway 会自动分配 `*.railway.app` 的域名，不需要买服务器。

⚠️ **注意**：Railway 是国外平台，国内访问速度较慢，且免费实例会休眠（30分钟没人访问就停，有人访问时恢复）。

---

## 快速参考

| 操作 | 命令 |
|------|------|
| 构建前端 | `cd frontend && npm run build` |
| 本地启动 | `cd backend && node server.js` |
| 查看进程 | `pm2 list` |
| 查看日志 | `pm2 logs course-schedule` |
| 重启应用 | `pm2 restart course-schedule` |
| 添加教师 | `cd backend && node seed.js add "名字" "用户名" "密码"` |
| 重置密码 | `cd backend && node seed.js reset-password "用户名" "新密码"` |
| 查看教师 | `cd backend && node seed.js list` |
| 备份数据 | `cp backend/schedule.db backup/` |
