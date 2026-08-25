const nodemailer = require('nodemailer');
const db = require('../database');

// SMTP 邮件配置（从环境变量读取，不配置则不发邮件）
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.126.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER || 'kebiaoxia@126.com';
const SMTP_PASS = process.env.SMTP_PASS || 'PHb7Mq59JWz4QCgg';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const SITE_URL = process.env.SITE_URL || 'https://kebiaoxia.cn';

// transporter 单例：只在模块顶层创建一次，其他模块 require 本文件拿到同一实例
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

// ========== 账号过期邮件提醒 ==========
// 提前 7/3/1 天提醒，过期后告知数据保留 15 天；每阶段只发一次（expire_reminded 去重）
function sendExpiryReminder(teacher, daysLeft) {
  if (!teacher.email || !transporter) return;
  const expireDate = teacher.expires_at;
  let subject, body;
  const loginUrl = `${SITE_URL}/login`;

  if (daysLeft <= 0) {
    // 过期：数据保留 15 天后删除（以过期次日为第 1 天，共保留 15 天）
    const purgeDate = new Date(new Date(expireDate).getTime() + 16 * 86400000);
    const purgeDateStr = purgeDate.toISOString().split('T')[0];
    subject = '课表侠 - 账号已过期';
    body = `
      <p>您好，<strong>${teacher.name}</strong>：</p>
      <p>您的课表侠账号已于 <strong style="color:#f56c6c;">${expireDate}</strong> 过期。</p>
      <p>您的数据将保留 <strong style="color:#e6a23c;">15 天</strong>（至 <strong>${purgeDateStr}</strong>），逾期后将被全部删除。</p>
      <p>如需继续使用，请尽快联系管理员续费。</p>`;
  } else {
    const labels = { 7: '7 天', 3: '3 天', 1: '最后 1 天' };
    subject = `课表侠 - 账号即将过期（${labels[daysLeft]}）`;
    body = `
      <p>您好，<strong>${teacher.name}</strong>：</p>
      <p>您的课表侠账号将于 <strong style="color:#e6a23c;">${expireDate}</strong> 过期（${labels[daysLeft]}后到期）。</p>
      <p>为避免账号过期影响课程管理，请及时联系管理员续费。</p>`;
  }

  transporter.sendMail({
    from: SMTP_FROM,
    to: teacher.email,
    bcc: SMTP_FROM, // 教师本人 + 管理员都收到
    subject,
    html: `<div style="max-width:480px;margin:0 auto;font-family:sans-serif;">
      <h2 style="color:#667eea;">课表侠</h2>
      ${body}
      <p style="text-align:center;margin:24px 0;">
        <a href="${loginUrl}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;border-radius:6px;">前往登录</a>
      </p>
      <p style="color:#999;font-size:12px;">登录地址：${loginUrl}</p>
    </div>`
  }).then(() => {
    console.log(`📧 已发送过期提醒邮件(${daysLeft > 0 ? daysLeft + '天' : '已过期'})到 ${teacher.email}`);
  }).catch(e => console.error('发送过期提醒邮件失败:', e));
}

// ========== 注册审核通过邮件（管理员手动审核与超时自动通过共用） ==========
function sendApprovalEmail(teacher) {
  if (!teacher || teacher.source !== 'email' || !teacher.email || !transporter) return;
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
  }).then(() => {
    console.log(`📧 已发送注册审核通过邮件到 ${teacher.email}`);
  }).catch(e => console.error('发送审核通知邮件失败:', e));
}

function checkExpiringAccounts() {
  try {
    const rows = db.prepare(
      `SELECT id, name, email, expires_at, expire_reminded FROM teachers
       WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at != '' AND email IS NOT NULL AND email != ''`
    ).all();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const teacher of rows) {
      const expire = new Date(teacher.expires_at);
      if (isNaN(expire)) continue;
      expire.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((expire - now) / 86400000);
      const reminded = teacher.expire_reminded;

      let stage = null;
      if (daysLeft <= 0 && reminded !== 'expired') {
        stage = 'expired';        // 过期 → 发过期告知
      } else if (daysLeft === 1 && reminded !== '1' && reminded !== 'expired') {
        stage = '1';              // 最后 1 天
      } else if (daysLeft === 3 && reminded !== '3' && reminded !== '1' && reminded !== 'expired') {
        stage = '3';              // 3 天
      } else if (daysLeft === 7 && reminded !== '7') {
        stage = '7';              // 7 天
      }

      if (stage) {
        sendExpiryReminder(teacher, stage === 'expired' ? 0 : parseInt(stage));
        db.prepare(`UPDATE teachers SET expire_reminded = ? WHERE id = ?`).run(stage, teacher.id);
      }
    }
  } catch (e) {
    console.error('检查账号过期提醒失败:', e);
  }
}

// ========== 注册申请超时自动通过 ==========
// 用条件 UPDATE (WHERE status='pending') 保证幂等：只有自己把 pending→active 的那一次 changes>0，才发邮件
function checkPendingRegistrations() {
  const seconds = parseInt(process.env.AUTO_APPROVE_SECONDS || '60', 10);
  if (isNaN(seconds) || seconds <= 0) return; // 0 / 负数 / 非法值 = 禁用

  try {
    // created_at 由 DEFAULT CURRENT_TIMESTAMP 生成（UTC 'YYYY-MM-DD HH:MM:SS'），
    // 与 datetime('now', ?) 同格式同时区，字符串比较即时间比较，无需 JS 侧 Date 换算。
    const rows = db.prepare(
      `SELECT id, name, email, source FROM teachers
       WHERE status = 'pending' AND source = 'email'
         AND created_at IS NOT NULL
         AND datetime('now', ?) >= created_at`
    ).all('-' + seconds + ' seconds');

    for (const teacher of rows) {
      const info = db.prepare(
        `UPDATE teachers SET status = 'active' WHERE id = ? AND status = 'pending'`
      ).run(teacher.id);
      if (info.changes > 0) {
        console.log(`⚡ 注册申请超时自动通过: ${teacher.name} <${teacher.email}>`);
        sendApprovalEmail(teacher);
      }
    }
  } catch (e) {
    console.error('自动通过注册申请失败:', e);
  }
}

module.exports = { transporter, SMTP_FROM, SITE_URL, sendExpiryReminder, checkExpiringAccounts, sendApprovalEmail, checkPendingRegistrations };
