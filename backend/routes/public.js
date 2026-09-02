const express = require('express');
const crypto = require('crypto');
const db = require('../database');
const { transporter, SMTP_FROM, SITE_URL } = require('../services/mailer');

const router = express.Router();

router.post('/api/register', (req, res) => {
  try {
    const { name, email, password, confirm_password, role } = req.body;
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
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const finalRole = role === 'manager' ? 'manager' : 'teacher';
    // 新注册用户默认 1 个月免费体验期（注册时刻起算），过期后由现有流程接管（提醒/保留15天/清理）
    const trialExpiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
    db.prepare(
      `INSERT INTO teachers (name, password, email, source, status, role, expires_at) VALUES (?, ?, ?, 'email', 'pending', ?, ?)`
    ).run(name, hash, email, finalRole, trialExpiresAt);

    // 给系统邮箱发送新用户注册通知
    if (transporter) {
      const roleLabel = finalRole === 'manager' ? '管理员' : '教师';
      transporter.sendMail({
        from: SMTP_FROM,
        to: SMTP_FROM,
        subject: '课表侠 - 新用户注册通知',
        html: `<div style="max-width:480px;margin:0 auto;font-family:sans-serif;">
          <h2 style="color:#667eea;">课表侠</h2>
          <p>有新的用户注册，请尽快审核：</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;">
            <p>👤 姓名：<strong>${name}</strong></p>
            <p>📧 邮箱：${email}</p>
            <p>🏷️ 身份：${roleLabel}</p>
          </div>
          <p style="text-align:center;margin:24px 0;">
            <a href="${SITE_URL}/login" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;border-radius:6px;">前往审核</a>
          </p>
          <p style="color:#999;font-size:12px;">登录地址：${SITE_URL}</p>
        </div>`
      }).catch(e => console.error('发送新用户注册通知失败:', e));
    }

    res.json({ message: '注册成功，请等待管理员审核' });
  } catch (err) {
    console.error('注册失败:', err);
    res.status(500).json({ error: '注册失败' });
  }
});

// ========== Admin 用户管理 ==========

// 获取所有教师（仅 admin）

router.post('/api/forgot-password', (req, res) => {
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

router.post('/api/reset-password', (req, res) => {
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

router.get('/api/holidays/:year', async (req, res) => {
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

module.exports = router;
