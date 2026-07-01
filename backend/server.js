const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// ========== 认证中间件 ==========
// 检查请求头 Authorization: Bearer <token>
// 通过后在 req.teacher 上挂载教师信息
function authMiddleware(req, res, next) {
  // 登录接口不需要验证（Express 挂载在 /api 下，req.path 不包含 /api）
  if (req.path === '/login') return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const token = authHeader.slice(7);
  const teacher = db.prepare(`SELECT id, name, username FROM teachers WHERE token = ?`).get(token);

  if (!teacher) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }

  req.teacher = teacher;
  next();
}

// 所有 /api/* 请求都经过认证检查
app.use('/api', authMiddleware);

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
      `SELECT id, name, username FROM teachers WHERE username = ? AND password = ?`
    ).get(username, hash);

    if (!teacher) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 生成随机 token
    const token = crypto.randomBytes(48).toString('hex');
    db.prepare(`UPDATE teachers SET token = ? WHERE id = ?`).run(token, teacher.id);

    res.json({
      data: {
        token,
        teacher: { id: teacher.id, name: teacher.name, username: teacher.username }
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
      db.prepare(`UPDATE teachers SET token = NULL WHERE id = ?`).run(req.teacher.id);
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

// 创建新课（自动归属当前教师）
app.post('/api/courses', (req, res) => {
  try {
    const { student_name, date, start_time, end_time, color, description } = req.body;
    if (!student_name || !date || !start_time || !end_time) {
      return res.status(400).json({ error: '请填写必要字段: student_name, date, start_time, end_time' });
    }
    const result = db.prepare(
      `INSERT INTO courses (teacher_id, student_name, date, start_time, end_time, color, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(req.teacher.id, student_name, date, start_time, end_time, color || '#409EFF', description || '');
    const course = db.prepare(`SELECT * FROM courses WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ data: course });
  } catch (err) {
    console.error('创建课程失败:', err);
    res.status(500).json({ error: '创建课程失败' });
  }
});

// 更新课程（admin 可改任何课程，普通老师只能改自己的）
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

    const { student_name, date, start_time, end_time, color, description } = req.body;
    db.prepare(
      `UPDATE courses SET student_name = ?, date = ?, start_time = ?, end_time = ?,
       color = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(
      student_name || existing.student_name,
      date || existing.date,
      start_time || existing.start_time,
      end_time || existing.end_time,
      color || existing.color,
      description !== undefined ? description : existing.description,
      id
    );
    const updated = db.prepare(`SELECT * FROM courses WHERE id = ?`).get(id);
    res.json({ data: updated });
  } catch (err) {
    console.error('更新课程失败:', err);
    res.status(500).json({ error: '更新课程失败' });
  }
});

// 删除课程（admin 可删任何课程，普通老师只能删自己的）
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
    db.prepare(`DELETE FROM courses WHERE id = ?`).run(id);
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('删除课程失败:', err);
    res.status(500).json({ error: '删除课程失败' });
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
