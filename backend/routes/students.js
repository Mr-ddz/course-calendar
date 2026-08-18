const express = require('express');
const db = require('../database');
const { accessibleClause, resolveTeacherFilter } = require('../services/access');

const router = express.Router();

router.get('/api/students', (req, res) => {
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

    const stuAccess = accessibleClause(req.teacher, 's');
    conditions.push(stuAccess.sql);
    params.push(...stuAccess.params);
    if (name) { conditions.push("s.name LIKE ?"); params.push(`%${name}%`); }
    const stf = resolveTeacherFilter(req.query.teacher_id, "s");
    if (stf) { conditions.push(stf.sql); params.push(...stf.params); }

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
router.post('/api/students', (req, res) => {
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
router.put('/api/students/:id', (req, res) => {
  try {
    const { id } = req.params;
    let existing;
    existing = db.prepare(`SELECT * FROM students WHERE id = ?`).get(id);
    if (existing) {
      const stuA = accessibleClause(req.teacher, 's');
      const ok = db.prepare(`SELECT 1 as ok FROM students s WHERE s.id = ? AND ${stuA.sql}`).get(id, ...stuA.params);
      if (!ok) existing = null;
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

// 删除学生及其所有课程和流水
router.delete('/api/students/:id', (req, res) => {
  try {
    const { id } = req.params;
    let student;
    student = db.prepare(`SELECT * FROM students WHERE id = ?`).get(id);
    if (student) {
      const stuA = accessibleClause(req.teacher, 's');
      const ok = db.prepare(`SELECT 1 as ok FROM students s WHERE s.id = ? AND ${stuA.sql}`).get(id, ...stuA.params);
      if (!ok) student = null;
    }
    if (!student) return res.status(404).json({ error: '学生不存在或无权操作' });

    // 删除该学生所有课程
    db.prepare(`DELETE FROM courses WHERE student_id = ?`).run(id);
    // 删除该学生所有预交流水
    db.prepare(`DELETE FROM prepaid_transactions WHERE student_id = ?`).run(id);
    // 删除学生
    db.prepare(`DELETE FROM students WHERE id = ?`).run(id);

    res.json({ message: `已删除学生「${student.name}」及其所有课程数据` });
  } catch (err) {
    console.error('删除学生失败:', err);
    res.status(500).json({ error: '删除学生失败' });
  }
});

// 学生充值（含自动补扣）
router.post('/api/students/:id/recharge', (req, res) => {
  try {
    const { id } = req.params;
    let student;
    student = db.prepare(`SELECT * FROM students WHERE id = ?`).get(id);
    if (student) {
      const stuA = accessibleClause(req.teacher, 's');
      const ok = db.prepare(`SELECT 1 as ok FROM students s WHERE s.id = ? AND ${stuA.sql}`).get(id, ...stuA.params);
      if (!ok) student = null;
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
router.get('/api/students/:id/transactions', (req, res) => {
  try {
    const { id } = req.params;
    let student;
    student = db.prepare(`SELECT * FROM students WHERE id = ?`).get(id);
    if (student) {
      const stuA = accessibleClause(req.teacher, 's');
      const ok = db.prepare(`SELECT 1 as ok FROM students s WHERE s.id = ? AND ${stuA.sql}`).get(id, ...stuA.params);
      if (!ok) student = null;
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
router.get('/api/students/recent-fee', (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: '请提供学生 ID' });

    const student = db.prepare(`SELECT hourly_fee FROM students WHERE id = ?`).get(id);
    if (student && student.hourly_fee > 0) {
      return res.json({ data: { hourly_fee: student.hourly_fee, color: '#409EFF' } });
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

// 获取指定日期的课程

module.exports = router;
