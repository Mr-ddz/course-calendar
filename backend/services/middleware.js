const db = require('../database');

// ========== 认证中间件 ==========
// 检查请求头 Authorization: Bearer <token>
// 通过后在 req.teacher 上挂载教师信息
function authMiddleware(req, res, next) {
  // 登录接口不需要验证（Express 挂载在 /api 下，req.path 不包含 /api）
  if (req.path === '/login' || req.path === '/register' || req.path === '/refresh' || req.path === '/forgot-password' || req.path === '/reset-password' || req.path === '/holidays' || req.path.startsWith('/holidays/')) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const token = authHeader.slice(7);
  const teacher = db.prepare(`SELECT id, name, role, token_expires_at FROM teachers WHERE token = ?`).get(token);

  if (!teacher) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }

  // 检查 token 是否过期（过期但不清除，让 refresh 接口处理）
  if (teacher.token_expires_at && Date.now() > new Date(teacher.token_expires_at).getTime()) {
    return res.status(401).json({ error: 'token_expired', message: 'Token 已过期，请刷新' });
  }

  req.teacher = teacher;
  next();
}

// ========== 频率限制（防暴力破解 + 防注册攻击） ==========
const rateLimitStore = {};
function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  if (!rateLimitStore[ip]) {
    rateLimitStore[ip] = { login: { count: 0, time: now }, register: { count: 0, time: now } };
  }

  if (req.path === '/login') {
    if (now - rateLimitStore[ip].login.time > 15 * 60 * 1000) {
      rateLimitStore[ip].login = { count: 0, time: now };
    }
    rateLimitStore[ip].login.count++;
    if (rateLimitStore[ip].login.count > 10) {
      return res.status(429).json({ error: '登录尝试次数过多，请15分钟后再试' });
    }
  }

  if (req.path === '/register') {
    if (now - rateLimitStore[ip].register.time > 60 * 60 * 1000) {
      rateLimitStore[ip].register = { count: 0, time: now };
    }
    rateLimitStore[ip].register.count++;
    if (rateLimitStore[ip].register.count > 3) {
      return res.status(429).json({ error: '注册尝试次数过多，请1小时后再试' });
    }
  }

  if (req.path === '/forgot-password') {
    if (!rateLimitStore[ip].forgot) rateLimitStore[ip].forgot = { count: 0, time: now };
    if (now - rateLimitStore[ip].forgot.time > 60 * 60 * 1000) {
      rateLimitStore[ip].forgot = { count: 0, time: now };
    }
    rateLimitStore[ip].forgot.count++;
    if (rateLimitStore[ip].forgot.count > 3) {
      return res.status(429).json({ error: '操作过于频繁，请1小时后再试' });
    }
  }

  next();
}

module.exports = { authMiddleware, rateLimiter };
