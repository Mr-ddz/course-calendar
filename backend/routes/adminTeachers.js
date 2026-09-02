const express = require('express');
const crypto = require('crypto');
const db = require('../database');
const { getRole, isSuperAdmin, ADMIN_ID } = require('../services/access');
const { transporter, SMTP_FROM, SITE_URL, sendApprovalEmail } = require('../services/mailer');

const router = express.Router();

// 获取所有教师（仅 admin）
router.get('/api/admin/teachers', (req, res) => {
  try {
    if (!isSuperAdmin(req.teacher) && getRole(req.teacher) !== 'manager') return res.status(403).json({ error: '无权访问' });
    const { role } = req.query;
    const inactiveSql = `,
      CASE WHEN (
        (
          (s.last_login_at IS NULL AND s.created_at < date('now', '-30 days'))
          OR
          (s.last_login_at IS NOT NULL AND s.last_login_at < date('now', '-3 months'))
        )
        AND (
          SELECT COALESCE(MAX(c.updated_at), '1970-01-01') FROM courses c WHERE c.teacher_id = s.id
        ) < date('now', '-3 months')
      ) AND s.status = 'active' AND s.id != 1
      THEN 1 ELSE 0 END as _inactive`;
    if (isSuperAdmin(req.teacher)) {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const pageSize = Math.max(1, parseInt(req.query.page_size) || 20);
      const offset = (page - 1) * pageSize;
      const baseSql = `SELECT s.*${inactiveSql} FROM teachers s`;
      let whereSql = '';
      let countParams = [];
      let dataParams = [];
      if (role) {
        whereSql = ' WHERE s.role = ?';
        countParams = [role];
        dataParams = [role];
      }
      const { total } = db.prepare(`SELECT COUNT(*) as total FROM teachers s${whereSql}`).get(...countParams);
      const teachers = db.prepare(`${baseSql}${whereSql} ORDER BY s.id LIMIT ? OFFSET ?`).all(...dataParams, pageSize, offset);
      res.json({ data: teachers, total, page, page_size: pageSize });
    } else {
      // manager 只能看见自己名下的教师
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const pageSize = Math.max(1, parseInt(req.query.page_size) || 20);
      const offset = (page - 1) * pageSize;
      const { total } = db.prepare(`SELECT COUNT(*) as total FROM teachers s WHERE s.managed_by = ?`).get(req.teacher.id);
      const teachers = db.prepare(`SELECT s.*${inactiveSql} FROM teachers s WHERE s.managed_by = ? ORDER BY s.id LIMIT ? OFFSET ?`).all(req.teacher.id, pageSize, offset);
      res.json({ data: teachers, total, page, page_size: pageSize });
    }
    
  } catch (err) {
    console.error('获取教师列表失败:', err);
    res.status(500).json({ error: '获取失败' });
  }
});

// Admin 手动添加教师
router.post('/api/admin/teachers', (req, res) => {
  try {
    const isManagerUser = getRole(req.teacher) === 'manager';
    if (!isSuperAdmin(req.teacher) && !isManagerUser) return res.status(403).json({ error: '无权访问' });
    let { name, password, role, email, managed_by } = req.body;
    if (isManagerUser) role = 'teacher';
    if (!name || !password) {
      return res.status(400).json({ error: '请填写姓名和密码' });
    }
    if (!email) {
      return res.status(400).json({ error: '请填写邮箱' });
    }
    const emailExists = db.prepare(`SELECT id FROM teachers WHERE email = ?`).get(email);
    if (emailExists) return res.status(400).json({ error: '该邮箱已被使用' });

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const finalRole = role || 'teacher';
    let finalManagedBy = req.teacher.id;
    // super_admin 创建 teacher 时可以选择归属到某个 manager 下
    if (isSuperAdmin(req.teacher) && finalRole === 'teacher' && managed_by) {
      finalManagedBy = parseInt(managed_by);
    }
    const result = db.prepare(
      `INSERT INTO teachers (name, password, email, source, status, role, managed_by) VALUES (?, ?, ?, 'admin', 'active', ?, ?)`
    ).run(name, hash, email, finalRole, finalManagedBy);
    const teacher = db.prepare(`SELECT id, name, email, source, status, role FROM teachers WHERE id = ?`).get(result.lastInsertRowid);

    // 发送邮件通知
    if (teacher.email && transporter) {
      const loginUrl = `${SITE_URL}/login`;
      const roleLabel = finalRole === 'manager' ? '管理员' : '教师';
      const subject = `您已被添加为课表侠${roleLabel}`;
      // 管理员邮箱：有归属 manager 则用 manager 的邮箱，否则用系统邮箱
      let adminEmail = SMTP_FROM;
      if (finalRole === 'teacher' && finalManagedBy) {
        const mgr = db.prepare(`SELECT email FROM teachers WHERE id = ?`).get(finalManagedBy);
        if (mgr && mgr.email) adminEmail = mgr.email;
      }
      const html = `<div style="max-width:480px;margin:0 auto;font-family:sans-serif;">
        <h2 style="color:#667eea;">课表侠</h2>
        <p>尊敬的 <strong>${teacher.name}</strong>：</p>
        <p>您已被添加为课表侠${roleLabel}账号。</p>
        <p>请使用以下信息登录：</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;">
          <p>🔗 网址：<a href="${loginUrl}" style="color:#667eea;">${loginUrl}</a></p>
          <p>👤 账户：${teacher.email}</p>
          <p>🔑 初始密码：<strong>${password}</strong></p>
        </div>
        <p>登录后建议立即修改密码。</p>
        <p>如有任何问题，请联系您的 <u><a href="mailto:${adminEmail}" style="color:#667eea;">管理员</a></u>。</p>
        <p style="color:#999;font-size:12px;margin-top:24px;">课表侠团队</p>
      </div>`;
      transporter.sendMail({
        from: SMTP_FROM,
        to: teacher.email,
        subject,
        html
      }).then(() => {
        console.log(`📧 已发送${roleLabel}创建通知邮件到 ${teacher.email}`);
      }).catch(e => console.error('发送创建通知邮件失败:', e));
    }

    res.status(201).json({ data: teacher });
  } catch (err) {
    console.error('添加教师失败:', err);
    res.status(500).json({ error: '添加失败' });
  }
});

// 更新教师状态（禁用/启用）
router.put('/api/admin/teachers/:id', (req, res) => {
  try {
    const isManagerUser = getRole(req.teacher) === 'manager';
    if (!isSuperAdmin(req.teacher) && !isManagerUser) return res.status(403).json({ error: '无权访问' });
    const { id } = req.params;
    if (parseInt(id) === ADMIN_ID) return res.status(400).json({ error: '不能操作超级管理员账号' });
    if (isManagerUser) {
      const target = db.prepare(`SELECT id, managed_by FROM teachers WHERE id = ?`).get(id);
      if (!target || target.managed_by !== req.teacher.id) return res.status(403).json({ error: '无权操作该教师' });
    }
    // 更新前预读旧状态：仅 pending→active 才发审核邮件，避免与超时自动通过重复发信
    const before = db.prepare(`SELECT id, status FROM teachers WHERE id = ?`).get(id);
    if (!before) return res.status(404).json({ error: '教师不存在' });
    const oldStatus = before.status;
    const { status, name, password, role, expires_at } = req.body;
    const updates = [];
    const params = [];
    const isResetPwd = !!password; // 记录是否在重置密码
    if (status) { updates.push('status = ?'); params.push(status); }
    if (name) { updates.push('name = ?'); params.push(name); }
    if (password) { updates.push('password = ?'); params.push(crypto.createHash('sha256').update(password).digest('hex')); }
    if (role) { updates.push('role = ?'); params.push(role); }
    if (expires_at !== undefined) { updates.push('expires_at = ?'); params.push(expires_at); }
    if (updates.length === 0) return res.status(400).json({ error: '没有需要更新的字段' });
    params.push(id);
    db.prepare(`UPDATE teachers SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const teacher = db.prepare(`SELECT id, name, email, source, status, role, expires_at FROM teachers WHERE id = ?`).get(id);

    // 审核通过时发送邮件通知（仅当本次操作是从 pending→active，避免与超时自动通过重复发信）
    if (status === 'active' && oldStatus === 'pending') {
      sendApprovalEmail(teacher);
    }

    // 重置密码时发送邮件通知
    if (isResetPwd && teacher.email && transporter) {
      const loginUrl = `${SITE_URL}/login`;
      transporter.sendMail({
        from: SMTP_FROM,
        to: teacher.email,
        subject: '课表侠 - 密码已重置',
        html: `<div style="max-width:480px;margin:0 auto;font-family:sans-serif;">
          <h2 style="color:#667eea;">课表侠</h2>
          <p>尊敬的 <strong>${teacher.name}</strong>：</p>
          <p>您的课表侠密码已被管理员重置。</p>
          <p>请使用以下信息登录：</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;">
            <p>🔗 网址：<a href="${loginUrl}" style="color:#667eea;">${loginUrl}</a></p>
            <p>👤 账户：<strong>${teacher.email}</strong></p>
            <p>🔑 新密码：<strong>${password}</strong></p>
          </div>
          <p>登录后建议立即修改密码。</p>
          <p style="color:#999;font-size:12px;margin-top:24px;">课表侠团队</p>
        </div>`
      }).then(() => {
        console.log(`📧 已发送密码重置邮件到 ${teacher.email}`);
      }).catch(e => console.error('发送密码重置邮件失败:', e));
    }

    res.json({ data: teacher });
  } catch (err) {
    console.error('更新教师失败:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

// 删除教师及其所有数据
router.delete('/api/admin/teachers/:id', (req, res) => {
  try {
    const isManagerUser = getRole(req.teacher) === 'manager';
    if (!isSuperAdmin(req.teacher) && !isManagerUser) return res.status(403).json({ error: '无权访问' });
    const { id } = req.params;
    if (parseInt(id) === ADMIN_ID) return res.status(400).json({ error: '不能删除超级管理员账号' });
    if (isManagerUser) {
      const target = db.prepare(`SELECT id, managed_by FROM teachers WHERE id = ?`).get(id);
      if (!target || target.managed_by !== req.teacher.id) return res.status(403).json({ error: '无权操作该教师' });
    }

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

module.exports = router;
