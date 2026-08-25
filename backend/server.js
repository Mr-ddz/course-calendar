const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./database');
const { checkExpiringAccounts, checkPendingRegistrations } = require('./services/mailer');
const { preloadHolidays } = require('./services/holidays');
const { authMiddleware, rateLimiter } = require('./services/middleware');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// 所有 /api/* 请求都经过认证检查
app.use('/api', authMiddleware);

// ========== 频率限制（防暴力破解 + 防注册攻击） ==========
app.use('/api', rateLimiter);

// 认证路由（登录/登出/me/refresh）
app.use(require('./routes/auth'));

// 公共路由（注册/忘记密码/重置密码/节假日）
app.use(require('./routes/public'));

// 教师列表
app.use(require('./routes/teachers'));

// Admin 用户管理
app.use(require('./routes/adminTeachers'));

// 学生管理
app.use(require('./routes/students'));

// 课程管理
app.use(require('./routes/courses'));

// ========== 生产环境：提供前端静态文件 ==========
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distPath));

// 所有非 API 请求返回 index.html（支持前端路由）
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ========== 启动 ==========
preloadHolidays();
// 启动前检查数据库字段完整性（防止部署后忘记重启）
try {
  db.prepare(`SELECT role FROM teachers LIMIT 1`).get();
} catch (e) {
  console.error('❌ 数据库缺少 role 字段，迁移未执行。请执行:');
  console.error('   sqlite3 backend/data/schedule.db "ALTER TABLE teachers ADD COLUMN role TEXT DEFAULT \'teacher\'"');
  process.exit(1);
}
// 启动即检查一次，之后每 6 小时检查一次
checkExpiringAccounts();
setInterval(checkExpiringAccounts, 6 * 3600 * 1000);

// ========== 注册申请超时自动通过（AUTO_APPROVE_SECONDS=0/负数 即禁用） ==========
const AUTO_APPROVE_SECONDS = parseInt(process.env.AUTO_APPROVE_SECONDS || '60', 10);
if (!isNaN(AUTO_APPROVE_SECONDS) && AUTO_APPROVE_SECONDS > 0) {
  checkPendingRegistrations();                       // 启动立即扫一次，处理停机期间积压
  setInterval(checkPendingRegistrations, 15 * 1000); // 每 15 秒扫一次
  console.log(`⚡ 注册申请自动通过已启用：超过 ${AUTO_APPROVE_SECONDS} 秒自动通过`);
} else {
  console.log(`⚡ 注册申请自动通过已禁用（AUTO_APPROVE_SECONDS=${AUTO_APPROVE_SECONDS}）`);
}
app.listen(PORT, '0.0.0.0', () => {
  console.log(`📚 课程表已启动: http://localhost:${PORT}`);
});
