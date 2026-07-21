const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('./database');

// SMTP 邮件配置（从环境变量读取，不配置则不发邮件）
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.126.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER || 'kebiaoxia@126.com';
const SMTP_PASS = process.env.SMTP_PASS || 'PHb7Mq59JWz4QCgg';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const SITE_URL = process.env.SITE_URL || 'https://kebiaoxia.cn';

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  console.log('📧 邮件服务已配置 (' + SMTP_USER + ')');
}

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

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
  const teacher = db.prepare(`SELECT id, name, username, token_expires_at FROM teachers WHERE token = ?`).get(token);

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

// 所有 /api/* 请求都经过认证检查
app.use('/api', authMiddleware);


// POST /api/refresh — 刷新 token
app.post('/api/refresh', (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: '缺少 refresh_token' });
    }

    const teacher = db.prepare(`SELECT id, name, username, email, source, status, refresh_token_expires_at FROM teachers WHERE refresh_token = ?`).get(refresh_token);

    if (!teacher) {
      return res.status(401).json({ error: 'refresh_token 无效' });
    }

    // 检查 refresh_token 是否过期
    if (teacher.refresh_token_expires_at && Date.now() > new Date(teacher.refresh_token_expires_at).getTime()) {
      db.prepare(`UPDATE teachers SET refresh_token = NULL, refresh_token_expires_at = NULL WHERE id = ?`).run(teacher.id);
      return res.status(401).json({ error: '登录已过期，请重新登录' });
    }

    // 生成新的 access token（2小时）
    const newToken = crypto.randomBytes(48).toString('hex');
    const newExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    db.prepare(`UPDATE teachers SET token = ?, token_expires_at = ? WHERE id = ?`).run(newToken, newExpiresAt, teacher.id);

    res.json({
      data: {
        token: newToken,
        refresh_token: refresh_token,
        teacher: { id: teacher.id, name: teacher.name, username: teacher.username, email: teacher.email || '', source: teacher.source || 'admin', status: teacher.status || 'active' }
      }
    });
  } catch (err) {
    console.error('刷新 token 失败:', err);
    res.status(500).json({ error: '刷新失败' });
  }
});

// ========== 频率限制（防暴力破解 + 防注册攻击） ==========
const rateLimitStore = {};
app.use('/api', (req, res, next) => {
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
});

// ========== 登录 / 登出 ==========

// POST /api/login — 登录
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const teacher = db.prepare(
      `SELECT id, name, username, email, source, status FROM teachers WHERE (username = ? OR email = ?) AND password = ? AND status = 'active'`
    ).get(username, username, hash);

    if (!teacher) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 生成 access token（2小时）+ refresh token（7天）
    const token = crypto.randomBytes(48).toString('hex');
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const refreshExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    db.prepare(`UPDATE teachers SET token = ?, token_expires_at = ?, refresh_token = ?, refresh_token_expires_at = ?, last_login_at = ? WHERE id = ?`).run(token, expiresAt, refreshToken, refreshExpiresAt, now, teacher.id);

    res.json({
      data: {
        token,
        refresh_token: refreshToken,
        teacher: { id: teacher.id, name: teacher.name, username: teacher.username, email: teacher.email || '', source: teacher.source || 'admin', status: teacher.status || 'active' }
      }
    });
  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({ error: '登录失败' });
  }
});

// POST /api/logout — 登出（清除 token）
app.post('/api/logout', (req, res) => {
  try {
    if (req.teacher) {
      const now = new Date().toISOString();
      db.prepare(`UPDATE teachers SET token = NULL, refresh_token = NULL, refresh_token_expires_at = NULL, last_logout_at = ? WHERE id = ?`).run(now, req.teacher.id);
    }
    res.json({ message: '已退出登录' });
  } catch (err) {
    console.error('登出失败:', err);
    res.status(500).json({ error: '登出失败' });
  }
});

// GET /api/me — 获取当前登录的教师信息
app.get('/api/me', (req, res) => {
  res.json({ data: req.teacher });
});

// GET /api/teachers — 获取所有教师列表
app.get('/api/teachers', (req, res) => {
  const teachers = db.prepare(`SELECT id, name, username FROM teachers ORDER BY id`).all();
  res.json({ data: teachers });
});

// ========== 学生管理 ==========

// 获取学生列表（支持搜索+分页，含预交费待补交计数）
app.get('/api/students', (req, res) => {
  try {
    const { name, page = 1, page_size = 20 } = req.query;
    const baseSql = `SELECT s.*,
      (SELECT COUNT(*) FROM prepaid_transactions pt WHERE pt.student_id = s.id AND pt.type = 'deduct_failed') as _failed_count,
      (SELECT COALESCE(SUM(ABS(pt2.amount)), 0) FROM prepaid_transactions pt2 WHERE pt2.student_id = s.id AND pt2.type = 'deduct_failed') as _failed_amount,
      (SELECT COALESCE(SUM(
        CAST(substr(c.end_time, 1, 2) AS INTEGER) * 60 + CAST(substr(c.end_time, 4, 2) AS INTEGER) -
        CAST(substr(c.start_time, 1, 2) AS INTEGER) * 60 - CAST(substr(c.start_time, 4, 2) AS INTEGER)
      ) / 60.0, 0) FROM courses c WHERE c.student_id = s.id AND c.attended = 1) as _total_hours
      FROM students s`;
    const countSql = `SELECT COUNT(*) as total FROM students s`;
    const conditions = [];
    const params = [];

    if (isAdmin(req.teacher)) {
      if (name) { conditions.push("s.name LIKE ?"); params.push(`%${name}%`); }
    } else {
      conditions.push("s.teacher_id = ?");
      params.push(req.teacher.id);
      if (name) { conditions.push("s.name LIKE ?"); params.push(`%${name}%`); }
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const { total } = db.prepare(`${countSql} ${whereClause}`).get(...params);

    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const students = db.prepare(`${baseSql} ${whereClause} ORDER BY s.name LIMIT ? OFFSET ?`).all(...params, parseInt(page_size), offset);

    res.json({ data: students, total, page: parseInt(page), page_size: parseInt(page_size) });
  } catch (err) {
    console.error('获取学生列表失败:', err);
    res.status(500).json({ error: '获取学生列表失败' });
  }
});

// 创建学生
app.post('/api/students', (req, res) => {
  try {
    const { name, grade, hourly_fee, payment_mode } = req.body;
    if (!name) return res.status(400).json({ error: '请输入学生姓名' });

    const result = db.prepare(
      `INSERT INTO students (name, grade, hourly_fee, payment_mode, teacher_id) VALUES (?, ?, ?, ?, ?)`
    ).run(name, grade || '', parseFloat(hourly_fee) || 0, payment_mode || 'settle', req.teacher.id);

    const student = db.prepare(`SELECT * FROM students WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ data: student });
  } catch (err) {
    console.error('创建学生失败:', err);
    res.status(500).json({ error: '创建学生失败' });
  }
});

// 编辑学生
app.put('/api/students/:id', (req, res) => {
  try {
    const { id } = req.params;
    let existing;
    if (isAdmin(req.teacher)) {
      existing = db.prepare(`SELECT * FROM students WHERE id = ?`).get(id);
    } else {
      existing = db.prepare(`SELECT * FROM students WHERE id = ? AND teacher_id = ?`).get(id, req.teacher.id);
    }
    if (!existing) return res.status(404).json({ error: '学生不存在或无权操作' });

    const { name, grade, hourly_fee, payment_mode } = req.body;
    const finalName = name || existing.name;
    const finalGrade = grade !== undefined ? grade : existing.grade;
    const finalPaymentMode = payment_mode || existing.payment_mode;

    db.prepare(
      `UPDATE students SET name = ?, grade = ?, hourly_fee = ?, payment_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(finalName, finalGrade, parseFloat(hourly_fee) || 0, finalPaymentMode, id);

    // 如果hourly_fee有变动，同步更新该学生所有未来未上的课程（已完成的课程保留历史价格）
    if (hourly_fee !== undefined && parseFloat(hourly_fee) != existing.hourly_fee) {
      const today = new Date().toISOString().split('T')[0];
      const updatedCourses = db.prepare(
        `UPDATE courses SET hourly_fee = ?, updated_at = CURRENT_TIMESTAMP WHERE student_id = ? AND date > ?`
      ).run(parseFloat(hourly_fee), id, today);
      if (updatedCourses.changes > 0) {
        console.log(`📦 已同步学生 #${id} 的 ${updatedCourses.changes} 节未来课程单价为 ¥${parseFloat(hourly_fee)}`);
      }
    }

    // 从 settle 改为 prepaid 时：自动追扣所有已签到但未扣费的课程
    if (payment_mode === 'prepaid' && existing.payment_mode !== 'prepaid') {
      // 查出该学生所有已签到（attended=1）且没有预交费记录的课程
      const pendingCourses = db.prepare(`
        SELECT c.id, c.date, c.start_time, c.end_time, c.hourly_fee
        FROM courses c
        WHERE c.student_id = ? AND c.attended = 1
          AND c.id NOT IN (SELECT course_id FROM prepaid_transactions WHERE student_id = ? AND course_id IS NOT NULL)
        ORDER BY c.date ASC, c.start_time ASC
      `).all(id, id);

      if (pendingCourses.length > 0) {
        let currentBalance = existing.prepaid_balance || 0;
        let deducted = 0, failed = 0;
        for (const c of pendingCourses) {
          const [sh, sm] = c.start_time.split(':').map(Number);
          const [eh, em] = c.end_time.split(':').map(Number);
          const durationHrs = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
          const fee = (c.hourly_fee || 0) * durationHrs;
          if (fee <= 0) continue;

          if (currentBalance >= fee) {
            currentBalance -= fee;
            db.prepare(
              `INSERT INTO prepaid_transactions (student_id, amount, balance_after, type, course_id, note) VALUES (?, ?, ?, 'deduct', ?, ?)`
            ).run(id, -fee, currentBalance, c.id, `历史课程追扣 ¥${fee.toFixed(0)}（${c.date} ${c.start_time}-${c.end_time}）`);
            deducted++;
          } else {
            db.prepare(
              `INSERT INTO prepaid_transactions (student_id, amount, balance_after, type, course_id, note) VALUES (?, ?, ?, 'deduct_failed', ?, ?)`
            ).run(id, -fee, currentBalance, c.id, `余额不足待补交 ¥${fee.toFixed(0)}（${c.date} ${c.start_time}-${c.end_time}）`);
            failed++;
          }
        }
        // 更新最终余额
        if (currentBalance !== (existing.prepaid_balance || 0)) {
          db.prepare(`UPDATE students SET prepaid_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(currentBalance, id);
        }
        console.log(`📦 学生 #${id} 切换预交模式：已追扣 ${deducted} 节，待补交 ${failed} 节`);
      }
    }

    const updated = db.prepare(`SELECT * FROM students WHERE id = ?`).get(id);
    res.json({ data: updated });
  } catch (err) {
    console.error('编辑学生失败:', err);
    res.status(500).json({ error: '编辑学生失败' });
  }
});

// 学生充值（含自动补扣）
app.post('/api/students/:id/recharge', (req, res) => {
  try {
    const { id } = req.params;
    let student;
    if (isAdmin(req.teacher)) {
      student = db.prepare(`SELECT * FROM students WHERE id = ?`).get(id);
    } else {
      student = db.prepare(`SELECT * FROM students WHERE id = ? AND teacher_id = ?`).get(id, req.teacher.id);
    }
    if (!student) return res.status(404).json({ error: '学生不存在或无权操作' });

    const { amount, note } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: '请输入有效的充值金额' });

    const newBalance = (student.prepaid_balance || 0) + parseFloat(amount);

    // 写入充值流水
    db.prepare(
      `INSERT INTO prepaid_transactions (student_id, amount, balance_after, type, note) VALUES (?, ?, ?, 'recharge', ?)`
    ).run(id, parseFloat(amount), newBalance, note || `充值 ¥${amount}`);

    // 更新余额
    db.prepare(`UPDATE students SET prepaid_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(newBalance, id);

    // 自动补扣：查出所有 deduct_failed，按日期 ASC 逐条尝试
    const failedList = db.prepare(
      `SELECT pt.*, c.hourly_fee, c.start_time, c.end_time FROM prepaid_transactions pt
       LEFT JOIN courses c ON pt.course_id = c.id
       WHERE pt.student_id = ? AND pt.type = 'deduct_failed' ORDER BY pt.created_at ASC`
    ).all(id);

    let autoDeducted = 0;
    let currentBalance = newBalance;
    for (const f of failedList) {
      if (currentBalance <= 0) break;
      // 从课程的 hourly_fee 和时长重新计算应扣金额
      if (f.hourly_fee && f.start_time && f.end_time) {
        const [sh, sm] = f.start_time.split(':').map(Number);
        const [eh, em] = f.end_time.split(':').map(Number);
        const durationHrs = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
        const fee = parseFloat(f.hourly_fee) * durationHrs;
        if (currentBalance >= fee) {
          currentBalance -= fee;
          // 将 deduct_failed 改为 deduct
          db.prepare(
            `UPDATE prepaid_transactions SET type = 'deduct', balance_after = ?, note = ? WHERE id = ?`
          ).run(currentBalance, `自动补扣 ¥${fee.toFixed(0)}（课程 #${f.course_id}）`, f.id);
          autoDeducted++;
        } else {
          break;
        }
      }
    }

    // 如果余额有变化（自动补扣后），更新最终余额
    if (currentBalance !== newBalance) {
      db.prepare(`UPDATE students SET prepaid_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(currentBalance, id);
    }

    // 查剩余待补交笔数
    const remainingFailed = db.prepare(
      `SELECT COUNT(*) as cnt FROM prepaid_transactions WHERE student_id = ? AND type = 'deduct_failed'`
    ).get(id);

    res.json({
      data: {
        balance: currentBalance,
        auto_deducted: autoDeducted,
        remaining_failed: remainingFailed.cnt
      }
    });
  } catch (err) {
    console.error('充值失败:', err);
    res.status(500).json({ error: '充值失败' });
  }
});

// 查学生预交流水
app.get('/api/students/:id/transactions', (req, res) => {
  try {
    const { id } = req.params;
    let student;
    if (isAdmin(req.teacher)) {
      student = db.prepare(`SELECT * FROM students WHERE id = ?`).get(id);
    } else {
      student = db.prepare(`SELECT * FROM students WHERE id = ? AND teacher_id = ?`).get(id, req.teacher.id);
    }
    if (!student) return res.status(404).json({ error: '学生不存在或无权操作' });

    const transactions = db.prepare(
      `SELECT * FROM prepaid_transactions WHERE student_id = ? ORDER BY created_at DESC LIMIT 100`
    ).all(id);

    res.json({ data: { balance: student.prepaid_balance || 0, transactions } });
  } catch (err) {
    console.error('查流水失败:', err);
    res.status(500).json({ error: '查流水失败' });
  }
});

// 获取学生最近一次课时费（优先读取学生本身的 hourly_fee，其次从最近课程取）
app.get('/api/students/recent-fee', (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: '请提供学生 ID' });

    const student = db.prepare(`SELECT hourly_fee, color FROM students WHERE id = ?`).get(id);
    if (student && student.hourly_fee > 0) {
      return res.json({ data: { hourly_fee: student.hourly_fee, color: student.color || '#409EFF' } });
    }

    const course = db.prepare(
      `SELECT hourly_fee, color FROM courses WHERE student_id = ? ORDER BY date DESC, id DESC LIMIT 1`
    ).get(id);
    res.json({ data: { hourly_fee: course ? course.hourly_fee : 0, color: course ? course.color : '#409EFF' } });
  } catch (err) {
    console.error('查询失败:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

// ========== 课程 CRUD（admin 可以看到全部，普通老师只看自己） ==========
const ADMIN_ID = 1;
function isAdmin(user) { return user.id === ADMIN_ID; }

// 获取指定日期的课程
app.get('/api/courses', (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: '请提供日期参数 date (YYYY-MM-DD)' });
    let courses;
    if (isAdmin(req.teacher)) {
      courses = db.prepare(`SELECT c.*, t.name as teacher_name FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id WHERE c.date = ? ORDER BY c.teacher_id, c.start_time ASC`).all(date);
    } else {
      courses = db.prepare(`SELECT * FROM courses WHERE teacher_id = ? AND date = ? ORDER BY start_time ASC`).all(req.teacher.id, date);
    }
    res.json({ data: courses });
  } catch (err) {
    console.error('获取课程失败:', err);
    res.status(500).json({ error: '获取课程失败' });
  }
});

// 获取日期范围内的课程
app.get('/api/courses/range', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({ error: '请提供 start_date 和 end_date 参数' });
    }
    let courses;
    if (isAdmin(req.teacher)) {
      courses = db.prepare(`SELECT c.*, t.name as teacher_name FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id WHERE c.date BETWEEN ? AND ? ORDER BY c.date ASC, c.start_time ASC`).all(start_date, end_date);
    } else {
      courses = db.prepare(`SELECT * FROM courses WHERE teacher_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC, start_time ASC`).all(req.teacher.id, start_date, end_date);
    }
    res.json({ data: courses });
  } catch (err) {
    console.error('获取课程范围失败:', err);
    res.status(500).json({ error: '获取课程范围失败' });
  }
});

// ===== 辅助函数：生成未来每周重复课程 =====
const MAX_WEEKS = 52;
function generateWeeklyCourses(teacherId, courseData, firstInsertId, startDateStr, start_time, end_time, color, description) {
  const { student_name, grade, hourly_fee, attended, student_id } = courseData;
  const startDate = new Date(startDateStr);
  const insertStmt = db.prepare(
    `INSERT INTO courses (teacher_id, student_id, student_name, date, start_time, end_time, color, description, grade, hourly_fee, attended, repeat_type, repeat_group_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'weekly', ?)`
  );

  const created = [{ id: firstInsertId, date: startDateStr }];
  for (let w = 1; w <= MAX_WEEKS; w++) {
    const nextDate = new Date(startDate);
    nextDate.setDate(nextDate.getDate() + w * 7);
    const dateStr = nextDate.toISOString().split('T')[0];
    const result = insertStmt.run(teacherId, student_id || null, student_name, dateStr, start_time, end_time, color || '#409EFF', description || '', grade || '', parseFloat(hourly_fee) || 0, attended ? 1 : 0, firstInsertId);
    created.push({ id: result.lastInsertRowid, date: dateStr });
  }
  return created;
}

// 创建新课
app.post('/api/courses', (req, res) => {
  try {
    let { student_id, student_name, date, start_time, end_time, color, description, grade, hourly_fee, attended, repeat_type } = req.body;
    if (!student_name || !date || !start_time || !end_time) {
      return res.status(400).json({ error: '请填写必要字段: student_name, date, start_time, end_time' });
    }

    // 处理学生关联：如果有 student_id 则从学生表取数据，否则自动创建
    if (student_id) {
      const student = db.prepare(`SELECT * FROM students WHERE id = ? AND (teacher_id = ? OR ? = 1)`).get(student_id, req.teacher.id, req.teacher.id);
      if (student) {
        student_name = student.name;
        grade = grade || student.grade;
        // 课程填了新的单价且和学生表不同步时，更新学生表
        if (hourly_fee && student.hourly_fee != hourly_fee) {
          db.prepare(`UPDATE students SET hourly_fee = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(parseFloat(hourly_fee), student.id);
        }
      } else {
        student_id = null;
      }
    }
    if (!student_id && student_name) {
      // 尝试查找已有学生，找不到就创建
      let existing = db.prepare(`SELECT id, grade, hourly_fee FROM students WHERE name = ? AND teacher_id = ?`).get(student_name, req.teacher.id);
      if (existing) {
        student_id = existing.id;
        grade = grade || existing.grade;
        // 课程填了新的单价且和学生表不同步时，更新学生表
        if (hourly_fee && existing.hourly_fee != hourly_fee) {
          db.prepare(`UPDATE students SET hourly_fee = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(parseFloat(hourly_fee), existing.id);
        }
      } else {
        const result = db.prepare(`INSERT INTO students (name, grade, hourly_fee, teacher_id) VALUES (?, ?, ?, ?)`).run(student_name, grade || '', parseFloat(hourly_fee) || 0, req.teacher.id);
        student_id = result.lastInsertRowid;
      }
    }

    // 先插入第一节课
    const result = db.prepare(
      `INSERT INTO courses (teacher_id, student_id, student_name, date, start_time, end_time, color, description, grade, hourly_fee, attended, repeat_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.teacher.id, student_id, student_name, date, start_time, end_time, color || '#409EFF', description || '', grade || '', parseFloat(hourly_fee) || 0, attended ? 1 : 0, repeat_type || 'none');

    const courseId = result.lastInsertRowid;

    // 如果是每周重复，把第一节课也加入组，并生成未来52周的课程
    if (repeat_type === 'weekly') {
      db.prepare(`UPDATE courses SET repeat_group_id = ? WHERE id = ?`).run(courseId, courseId);
      const courseData = { student_name, grade, hourly_fee, attended, student_id };
      generateWeeklyCourses(req.teacher.id, courseData, courseId, date, start_time, end_time, color, description);
    }

    const courses = db.prepare(`SELECT * FROM courses WHERE repeat_group_id = ? OR id = ? ORDER BY date ASC`).all(courseId, courseId);
    res.status(201).json({ data: courses.length > 1 ? courses : courses[0] });
  } catch (err) {
    console.error('创建课程失败:', err);
    res.status(500).json({ error: '创建课程失败' });
  }
});

// 更新课程
app.put('/api/courses/:id', (req, res) => {
  try {
    const { id } = req.params;
    let existing;
    if (isAdmin(req.teacher)) {
      existing = db.prepare(`SELECT * FROM courses WHERE id = ?`).get(id);
    } else {
      existing = db.prepare(`SELECT * FROM courses WHERE id = ? AND teacher_id = ?`).get(id, req.teacher.id);
    }
    if (!existing) return res.status(404).json({ error: '课程不存在或无权操作' });

    const { student_id, student_name, date, start_time, end_time, color, description, grade, hourly_fee, attended, repeat_type, update_all_future } = req.body;

    // 处理学生关联更新
    let finalName = student_name || existing.student_name;
    let finalGrade = grade !== undefined ? grade : existing.grade;
    let finalStudentId = student_id !== undefined ? student_id : existing.student_id;
    if (student_id && !student_name) {
      const s = db.prepare(`SELECT name, grade, hourly_fee FROM students WHERE id = ?`).get(student_id);
      if (s) { finalName = s.name; finalGrade = finalGrade || s.grade; finalStudentId = student_id; }
    }
    // 课程单价有变化时同步到学生表
    const targetStudentId = finalStudentId || existing.student_id;
    const finalHourlyFee = hourly_fee !== undefined ? parseFloat(hourly_fee) : existing.hourly_fee;
    if (targetStudentId && hourly_fee !== undefined) {
      const st = db.prepare(`SELECT hourly_fee FROM students WHERE id = ?`).get(targetStudentId);
      if (st && st.hourly_fee != finalHourlyFee) {
        db.prepare(`UPDATE students SET hourly_fee = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(finalHourlyFee, targetStudentId);
      }
    }

    // 如果更新所有未来课程（用于修改时间/费用等）
    if (update_all_future && existing.repeat_group_id) {
      const groupId = existing.repeat_group_id;
      db.prepare(
        `UPDATE courses SET student_name = ?, student_id = ?, start_time = ?, end_time = ?,
         color = ?, description = ?, grade = ?, hourly_fee = ?, attended = ?,
         updated_at = CURRENT_TIMESTAMP WHERE repeat_group_id = ? AND date >= ?`
      ).run(
        finalName, finalStudentId,
        start_time || existing.start_time,
        end_time || existing.end_time,
        color || existing.color,
        description !== undefined ? description : existing.description,
        finalGrade,
        hourly_fee !== undefined ? parseFloat(hourly_fee) || 0 : existing.hourly_fee,
        attended !== undefined ? (attended ? 1 : 0) : existing.attended,
        groupId,
        date || existing.date
      );
      const courses = db.prepare(`SELECT * FROM courses WHERE repeat_group_id = ? ORDER BY date ASC`).all(groupId);
      return res.json({ data: courses });
    }

    // 单独更新这节课
    db.prepare(
      `UPDATE courses SET student_name = ?, student_id = ?, date = ?, start_time = ?, end_time = ?,
       color = ?, description = ?, grade = ?, hourly_fee = ?, attended = ?, repeat_type = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(
      finalName, finalStudentId,
      date || existing.date,
      start_time || existing.start_time,
      end_time || existing.end_time,
      color || existing.color,
      description !== undefined ? description : existing.description,
      finalGrade,
      hourly_fee !== undefined ? parseFloat(hourly_fee) || 0 : existing.hourly_fee,
      attended !== undefined ? (attended ? 1 : 0) : existing.attended,
      repeat_type !== undefined ? repeat_type : existing.repeat_type,
      id
    );

    // ===== 预交费处理：签到/取消签到触发扣费或退款 =====
    if (attended !== undefined) {
      const wasAttended = existing.attended;
      const nowAttended = attended ? 1 : 0;
      // 只处理有 student_id 关联的情况
      const targetStudentId = finalStudentId || existing.student_id;
      if (targetStudentId && wasAttended !== nowAttended) {
        const student = db.prepare(`SELECT * FROM students WHERE id = ?`).get(targetStudentId);
        if (student && student.payment_mode === 'prepaid') {
          const [sh, sm] = (start_time || existing.start_time).split(':').map(Number);
          const [eh, em] = (end_time || existing.end_time).split(':').map(Number);
          const durationHrs = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
          const finalFee = (hourly_fee !== undefined ? parseFloat(hourly_fee) : existing.hourly_fee) * durationHrs;

          if (nowAttended === 1 && wasAttended === 0) {
            // 签到 → 尝试扣费
            if (finalFee > 0) {
              let currentBalance = student.prepaid_balance || 0;
              if (currentBalance >= finalFee) {
                const newBalance = currentBalance - finalFee;
                db.prepare(`UPDATE students SET prepaid_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(newBalance, targetStudentId);
                db.prepare(
                  `INSERT INTO prepaid_transactions (student_id, amount, balance_after, type, course_id, note) VALUES (?, ?, ?, 'deduct', ?, ?)`
                ).run(targetStudentId, -finalFee, newBalance, id, `课程扣除 ¥${finalFee.toFixed(0)}（${existing.date} ${existing.start_time}-${existing.end_time}）`);
              } else {
                // 余额不足 → 标记待补交
                db.prepare(
                  `INSERT INTO prepaid_transactions (student_id, amount, balance_after, type, course_id, note) VALUES (?, ?, ?, 'deduct_failed', ?, ?)`
                ).run(targetStudentId, -finalFee, currentBalance, id, `余额不足待补交 ¥${finalFee.toFixed(0)}（差额 ¥${(finalFee - currentBalance).toFixed(0)}）`);
              }
            }
          } else if (nowAttended === 0 && wasAttended === 1) {
            // 取消签到 → 退款
            const tx = db.prepare(`SELECT * FROM prepaid_transactions WHERE course_id = ? AND student_id = ? AND type IN ('deduct', 'deduct_failed')`).get(id, targetStudentId);
            if (tx) {
              if (tx.type === 'deduct') {
                // 之前扣过款，退还
                const refundAmount = Math.abs(tx.amount);
                const currentBalance = student.prepaid_balance || 0;
                const newBalance = currentBalance + refundAmount;
                db.prepare(`UPDATE students SET prepaid_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(newBalance, targetStudentId);
                db.prepare(
                  `INSERT INTO prepaid_transactions (student_id, amount, balance_after, type, course_id, note) VALUES (?, ?, ?, 'refund', ?, ?)`
                ).run(targetStudentId, refundAmount, newBalance, id, `取消签到退还 ¥${refundAmount.toFixed(0)}（课程 #${id}）`);
              }
              // 删除旧的扣款/待补交记录
              db.prepare(`DELETE FROM prepaid_transactions WHERE id = ?`).run(tx.id);
            }
          }
        }
      }
    }

    const updated = db.prepare(`SELECT * FROM courses WHERE id = ?`).get(id);
    res.json({ data: updated });
  } catch (err) {
    console.error('更新课程失败:', err);
    res.status(500).json({ error: '更新课程失败' });
  }
});

// 删除课程
app.delete('/api/courses/:id', (req, res) => {
  try {
    const { id } = req.params;
    let existing;
    if (isAdmin(req.teacher)) {
      existing = db.prepare(`SELECT * FROM courses WHERE id = ?`).get(id);
    } else {
      existing = db.prepare(`SELECT * FROM courses WHERE id = ? AND teacher_id = ?`).get(id, req.teacher.id);
    }
    if (!existing) return res.status(404).json({ error: '课程不存在或无权操作' });

    const { delete_all_future } = req.query;

    // 如果删除所有未来课程（同一组且从当前日期起的）
    if (delete_all_future === 'true' && existing.repeat_group_id) {
      const result = db.prepare(`DELETE FROM courses WHERE repeat_group_id = ? AND date >= ?`).run(existing.repeat_group_id, existing.date);
      return res.json({ message: `已删除 ${result.changes} 节课` });
    }

    db.prepare(`DELETE FROM courses WHERE id = ?`).run(id);
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('删除课程失败:', err);
    res.status(500).json({ error: '删除课程失败' });
  }
});

// ========== 统计 & 搜索 API ==========

// 搜索课程（模糊搜索 + 分页）
app.get('/api/courses/search', (req, res) => {
  try {
    const { student_name, grade, attended, page = 1, page_size = 20, start_date, end_date } = req.query;
    const conditions = [];
    const params = [];

    // 数据隔离
    if (!isAdmin(req.teacher)) {
      conditions.push('c.teacher_id = ?');
      params.push(req.teacher.id);
    }

    if (student_name) {
      conditions.push('c.student_name LIKE ?');
      params.push(`%${student_name}%`);
    }
    if (grade) {
      conditions.push('c.grade LIKE ?');
      params.push(`%${grade}%`);
    }
    if (attended === '1' || attended === '0' || attended === 1 || attended === 0) {
      conditions.push('c.attended = ?');
      params.push(Number(attended));
    }
    if (start_date) {
      conditions.push('c.date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('c.date <= ?');
      params.push(end_date);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // 查询总数
    const countSql = `SELECT COUNT(*) as total FROM courses c ${whereClause}`;
    const { total } = db.prepare(countSql).get(...params);

    // 分页查询
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const selectSql = isAdmin(req.teacher)
      ? `SELECT c.*, t.name as teacher_name FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id ${whereClause} ORDER BY c.date DESC, c.start_time ASC LIMIT ? OFFSET ?`
      : `SELECT c.* FROM courses c ${whereClause} ORDER BY c.date DESC, c.start_time ASC LIMIT ? OFFSET ?`;

    const data = db.prepare(selectSql).all(...params, parseInt(page_size), offset);

    res.json({ data, total, page: parseInt(page), page_size: parseInt(page_size) });
  } catch (err) {
    console.error('搜索课程失败:', err);
    res.status(500).json({ error: '搜索失败' });
  }
});

// 统计数据（按周/月/年）
app.get('/api/courses/statistics', (req, res) => {
  try {
    const { group_by = 'month', start_date, end_date } = req.query;

    let teacherCondition = '';
    const params = [];
    if (!isAdmin(req.teacher)) {
      teacherCondition = 'AND c.teacher_id = ?';
      params.push(req.teacher.id);
    }

    const dateFilter = [];
    if (start_date) {
      dateFilter.push('c.date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      dateFilter.push('c.date <= ?');
      params.push(end_date);
    }
    const dateWhere = dateFilter.length > 0 ? 'AND ' + dateFilter.join(' AND ') : '';

    // 时长计算辅助（分钟）
    const durationExpr = `(CAST(substr(c.end_time, 1, 2) AS REAL) * 60 + CAST(substr(c.end_time, 4, 2) AS REAL) - (CAST(substr(c.start_time, 1, 2) AS REAL) * 60 + CAST(substr(c.start_time, 4, 2) AS REAL)))`;

    // 按周/月/年分组统计
    let dateGroup;
    if (group_by === 'week') {
      dateGroup = "strftime('%Y-W%W', c.date)";
    } else if (group_by === 'year') {
      dateGroup = "strftime('%Y', c.date)";
    } else {
      dateGroup = "strftime('%Y-%m', c.date)";
    }

    const sql = `
      SELECT ${dateGroup} as period,
             COUNT(*) as course_count,
             SUM(${durationExpr}) / 60.0 as total_hours,
             SUM(c.hourly_fee * ${durationExpr} / 60.0) as total_fee,
             SUM(CASE WHEN c.attended = 1 THEN ${durationExpr} / 60.0 ELSE 0 END) as attended_hours,
             SUM(CASE WHEN c.attended = 1 THEN c.hourly_fee * ${durationExpr} / 60.0 ELSE 0 END) as attended_fee
      FROM courses c
      WHERE 1=1 ${teacherCondition} ${dateWhere}
      GROUP BY ${dateGroup}
      ORDER BY period ASC
    `;

    const data = db.prepare(sql).all(...params);

    // 总统计
    const totalSql = `
      SELECT COUNT(*) as total_courses,
             SUM(${durationExpr}) / 60.0 as total_hours,
             SUM(c.hourly_fee * ${durationExpr} / 60.0) as total_fee,
             SUM(CASE WHEN c.attended = 1 THEN c.hourly_fee * ${durationExpr} / 60.0 ELSE 0 END) as total_attended_fee
      FROM courses c
      WHERE 1=1 ${teacherCondition} ${dateWhere}
    `;
    const totals = db.prepare(totalSql).get(...params);

    res.json({ data, totals });
  } catch (err) {
    console.error('统计失败:', err);
    res.status(500).json({ error: '统计失败' });
  }
});



// POST /api/register — 邮箱注册（管理员审核后生效）
app.post('/api/register', (req, res) => {
  try {
    const { name, email, password, confirm_password } = req.body;
    if (!name || !email || !password || !confirm_password) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ error: '两次输入的密码不一致' });
    }

    // 防机器人
    if (req.body.website) {
      return res.status(400).json({ error: '无效的注册请求' });
    }

    // 检查邮箱是否已注册
    const existing = db.prepare(`SELECT id FROM teachers WHERE email = ?`).get(email);
    if (existing) {
      return res.status(400).json({ error: '该邮箱已注册' });
    }

    // 检查用户名是否已存在
    const nameExists = db.prepare(`SELECT id FROM teachers WHERE username = ?`).get(name);
    if (nameExists) {
      return res.status(400).json({ error: '该用户名已被使用' });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    db.prepare(
      `INSERT INTO teachers (name, username, password, email, source, status) VALUES (?, ?, ?, ?, 'email', 'pending')`
    ).run(name, name, hash, email);

    res.json({ message: '注册成功，请等待管理员审核' });
  } catch (err) {
    console.error('注册失败:', err);
    res.status(500).json({ error: '注册失败' });
  }
});

// ========== Admin 用户管理 ==========

// 获取所有教师（仅 admin）
app.get('/api/admin/teachers', (req, res) => {
  try {
    if (!isAdmin(req.teacher)) return res.status(403).json({ error: '无权访问' });
    const teachers = db.prepare(`SELECT id, name, username, email, source, status, created_at FROM teachers ORDER BY id`).all();
    res.json({ data: teachers });
  } catch (err) {
    console.error('获取教师列表失败:', err);
    res.status(500).json({ error: '获取失败' });
  }
});

// Admin 手动添加教师
app.post('/api/admin/teachers', (req, res) => {
  try {
    if (!isAdmin(req.teacher)) return res.status(403).json({ error: '无权访问' });
    const { name, username, password } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ error: '请填写姓名、用户名和密码' });
    }
    const existing = db.prepare(`SELECT id FROM teachers WHERE username = ?`).get(username);
    if (existing) return res.status(400).json({ error: '用户名已存在' });

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const result = db.prepare(
      `INSERT INTO teachers (name, username, password, source, status) VALUES (?, ?, ?, 'admin', 'active')`
    ).run(name, username, hash);
    const teacher = db.prepare(`SELECT id, name, username, email, source, status FROM teachers WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ data: teacher });
  } catch (err) {
    console.error('添加教师失败:', err);
    res.status(500).json({ error: '添加失败' });
  }
});

// 更新教师状态（禁用/启用）
app.put('/api/admin/teachers/:id', (req, res) => {
  try {
    if (!isAdmin(req.teacher)) return res.status(403).json({ error: '无权访问' });
    const { id } = req.params;
    if (parseInt(id) === ADMIN_ID) return res.status(400).json({ error: '不能禁用管理员账号' });
    const { status, name, password } = req.body;
    const updates = [];
    const params = [];
    if (status) { updates.push('status = ?'); params.push(status); }
    if (name) { updates.push('name = ?'); params.push(name); }
    if (password) { updates.push('password = ?'); params.push(crypto.createHash('sha256').update(password).digest('hex')); }
    if (updates.length === 0) return res.status(400).json({ error: '没有需要更新的字段' });
    params.push(id);
    db.prepare(`UPDATE teachers SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const teacher = db.prepare(`SELECT id, name, username, email, source, status FROM teachers WHERE id = ?`).get(id);

    // 审核通过时发送邮件通知
    if (status === 'active' && teacher.email && teacher.source === 'email' && transporter) {
      const loginUrl = `${SITE_URL}/login`;
      transporter.sendMail({
        from: SMTP_FROM,
        to: teacher.email,
        subject: '课表侠 - 注册审核通过',
        html: `<div style="max-width:480px;margin:0 auto;font-family:sans-serif;">
          <h2 style="color:#667eea;">课表侠</h2>
          <p>您好，<strong>${teacher.name}</strong>：</p>
          <p>您在课表侠的注册申请已通过审核。</p>
          <p>您现在可以使用注册时填写的邮箱或用户名登录，开始管理您的课程。</p>
          <p style="text-align:center;margin:24px 0;">
            <a href="${loginUrl}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;border-radius:6px;">前往登录</a>
          </p>
          <p style="color:#999;font-size:12px;">登录地址：${loginUrl}</p>
        </div>`
      }).catch(e => console.error('发送审核通知邮件失败:', e));
    }

    res.json({ data: teacher });
  } catch (err) {
    console.error('更新教师失败:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

// 删除教师及其所有数据
app.delete('/api/admin/teachers/:id', (req, res) => {
  try {
    if (!isAdmin(req.teacher)) return res.status(403).json({ error: '无权访问' });
    const { id } = req.params;
    if (parseInt(id) === ADMIN_ID) return res.status(400).json({ error: '不能删除管理员账号' });

    const teacher = db.prepare(`SELECT id, name FROM teachers WHERE id = ?`).get(id);
    if (!teacher) return res.status(404).json({ error: '教师不存在' });

    // 同步删除该教师的所有课程和学生
    db.prepare(`DELETE FROM courses WHERE teacher_id = ?`).run(id);
    db.prepare(`DELETE FROM students WHERE teacher_id = ?`).run(id);
    db.prepare(`DELETE FROM teachers WHERE id = ?`).run(id);

    res.json({ message: `已删除教师「${teacher.name}」及其所有数据` });
  } catch (err) {
    console.error('删除教师失败:', err);
    res.status(500).json({ error: '删除失败' });
  }
});


// POST /api/forgot-password — 发送密码重置邮件
app.post('/api/forgot-password', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: '请输入邮箱' });

    const teacher = db.prepare(`SELECT id, name FROM teachers WHERE email = ?`).get(email);
    // 不管邮箱是否存在，都返回成功（防止枚举邮箱）
    if (!teacher) return res.json({ message: '如果该邮箱已注册，重置链接已发送' });

    // 生成重置 token（1小时有效）
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare(`UPDATE teachers SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?`).run(resetToken, expiresAt, teacher.id);

    // 发送邮件
    if (transporter) {
      const resetUrl = `${SITE_URL}/reset-password?token=${resetToken}`;
      transporter.sendMail({
        from: SMTP_FROM,
        to: email,
        subject: '课表侠 - 密码重置',
        html: `<div style="max-width:480px;margin:0 auto;font-family:sans-serif;">
          <h2 style="color:#667eea;">课表侠</h2>
          <p>您好，<strong>${teacher.name}</strong>：</p>
          <p>请点击下方链接重置您的密码，链接有效期为 1 小时：</p>
          <p style="text-align:center;margin:24px 0;">
            <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;border-radius:6px;">重置密码</a>
          </p>
          <p style="color:#999;font-size:12px;">如果这不是您本人操作，请忽略此邮件。</p>
        </div>`
      }).catch(e => console.error('发送邮件失败:', e));
    } else {
      console.log('📧 邮件未配置，重置链接:', resetToken);
    }

    res.json({ message: '如果该邮箱已注册，重置链接已发送' });
  } catch (err) {
    console.error('发送重置邮件失败:', err);
    res.status(500).json({ error: '发送失败' });
  }
});

// POST /api/reset-password — 使用 token 重置密码
app.post('/api/reset-password', (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: '参数不完整' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });

    const teacher = db.prepare(`SELECT id, reset_token_expires_at FROM teachers WHERE reset_token = ?`).get(token);
    if (!teacher) return res.status(400).json({ error: '重置链接无效或已过期' });

    if (teacher.reset_token_expires_at && Date.now() > new Date(teacher.reset_token_expires_at).getTime()) {
      return res.status(400).json({ error: '重置链接已过期，请重新申请' });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    db.prepare(`UPDATE teachers SET password = ?, reset_token = NULL, reset_token_expires_at = NULL, token = NULL, refresh_token = NULL, refresh_token_expires_at = NULL WHERE id = ?`).run(hash, teacher.id);

    res.json({ message: '密码已重置，请重新登录' });
  } catch (err) {
    console.error('重置密码失败:', err);
    res.status(500).json({ error: '重置失败' });
  }
});


// GET /api/holidays/:year — 获取节假日数据（代理外部API）
app.get('/api/holidays/:year', async (req, res) => {
  try {
    const { year } = req.params;
    const response = await fetch(`https://timor.tech/api/holiday/year/${year}`, {
      signal: AbortSignal.timeout(5000)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('获取节假日失败:', err.message);
    res.json({ code: -1, error: err.message });
  }
});

// ========== 生产环境：提供前端静态文件 ==========
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distPath));

// 所有非 API 请求返回 index.html（支持前端路由）
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ========== 启动 ==========
app.listen(PORT, '0.0.0.0', () => {
  console.log(`📚 课程表已启动: http://localhost:${PORT}`);
});
