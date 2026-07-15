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
  if (req.path === '/login' || req.path === '/register' || req.path === '/refresh') return next();

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
      `SELECT id, name, username, email, source, status FROM teachers WHERE username = ? AND password = ? AND status = 'active'`
    ).get(username, hash);

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
      db.prepare(`UPDATE teachers SET token = NULL, last_logout_at = ? WHERE id = ?`).run(now, req.teacher.id);
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

// 获取学生列表（支持搜索）
app.get('/api/students', (req, res) => {
  try {
    const { name } = req.query;
    let students;
    if (isAdmin(req.teacher)) {
      if (name) {
        students = db.prepare(`SELECT * FROM students WHERE name LIKE ? ORDER BY name LIMIT 50`).all(`%${name}%`);
      } else {
        students = db.prepare(`SELECT * FROM students ORDER BY name`).all();
      }
    } else {
      if (name) {
        students = db.prepare(`SELECT * FROM students WHERE teacher_id = ? AND name LIKE ? ORDER BY name LIMIT 50`).all(req.teacher.id, `%${name}%`);
      } else {
        students = db.prepare(`SELECT * FROM students WHERE teacher_id = ? ORDER BY name`).all(req.teacher.id);
      }
    }
    res.json({ data: students });
  } catch (err) {
    console.error('获取学生列表失败:', err);
    res.status(500).json({ error: '获取学生列表失败' });
  }
});

// 创建学生
app.post('/api/students', (req, res) => {
  try {
    const { name, grade } = req.body;
    if (!name) return res.status(400).json({ error: '请输入学生姓名' });

    const result = db.prepare(
      `INSERT INTO students (name, grade, teacher_id) VALUES (?, ?, ?)`
    ).run(name, grade || '', req.teacher.id);

    const student = db.prepare(`SELECT * FROM students WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ data: student });
  } catch (err) {
    console.error('创建学生失败:', err);
    res.status(500).json({ error: '创建学生失败' });
  }
});

// 获取学生最近一次课时费
app.get('/api/students/recent-fee', (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: '请提供学生 ID' });
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
      } else {
        student_id = null;
      }
    }
    if (!student_id && student_name) {
      // 尝试查找已有学生，找不到就创建
      let existing = db.prepare(`SELECT id, grade FROM students WHERE name = ? AND teacher_id = ?`).get(student_name, req.teacher.id);
      if (existing) {
        student_id = existing.id;
        grade = grade || existing.grade;
      } else {
        const result = db.prepare(`INSERT INTO students (name, grade, teacher_id) VALUES (?, ?, ?)`).run(student_name, grade || '', req.teacher.id);
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
      const s = db.prepare(`SELECT name, grade FROM students WHERE id = ?`).get(student_id);
      if (s) { finalName = s.name; finalGrade = finalGrade || s.grade; finalStudentId = student_id; }
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
