const express = require('express');
const crypto = require('crypto');
const db = require('../database');

const router = express.Router();

router.post('/api/refresh', (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: '缺少 refresh_token' });
    }

    const teacher = db.prepare(`SELECT id, name, email, source, status, role, refresh_token_expires_at FROM teachers WHERE refresh_token = ?`).get(refresh_token);

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
        teacher: { id: teacher.id, name: teacher.name, email: teacher.email || '', source: teacher.source || 'admin', status: teacher.status || 'active', role: teacher.role || 'teacher' }
      }
    });
  } catch (err) {
    console.error('刷新 token 失败:', err);
    res.status(500).json({ error: '刷新失败' });
  }
});

// ========== 频率限制（防暴力破解 + 防注册攻击） ==========

router.post('/api/login', (req, res) => {
  try {
    const { identity, password } = req.body;
    if (!identity || !password) {
      return res.status(400).json({ error: '请输入邮箱和密码' });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    let teacher;
    if (identity === 'admin') {
      // admin (id=1) 通过名称登录
      teacher = db.prepare(
        `SELECT id, name, email, source, status, role, expires_at FROM teachers WHERE id = 1 AND password = ? AND status = 'active'`
      ).get(hash);
    } else {
      // 其他用户通过邮箱登录
      teacher = db.prepare(
        `SELECT id, name, email, source, status, role, expires_at FROM teachers WHERE email = ? AND password = ? AND status = 'active'`
      ).get(identity, hash);
    }

    if (!teacher) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // 检查账号是否过期
    if (teacher.expires_at && new Date(teacher.expires_at) < new Date()) {
      return res.status(403).json({ error: '账号已过期，请联系管理员续费' });
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
        teacher: { id: teacher.id, name: teacher.name, email: teacher.email || '', source: teacher.source || 'admin', status: teacher.status || 'active', role: teacher.role || 'teacher' }
      }
    });
  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({ error: '登录失败' });
  }
});

// POST /api/logout — 登出（清除 token）

router.post('/api/logout', (req, res) => {
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

router.get('/api/me', (req, res) => {
  res.json({ data: req.teacher });
});

// GET /api/teachers — 获取所有教师列表

module.exports = router;
