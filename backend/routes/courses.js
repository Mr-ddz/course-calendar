const express = require('express');
const db = require('../database');
const { getRole, isSuperAdmin, feeError, accessibleClause, resolveTeacherFilter } = require('../services/access');
const { generateWeeklyCourses, generateWeekdaysCourses, generateGenericRepeat } = require('../services/courseGenerators');

const router = express.Router();

router.get('/api/courses', (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: '请提供日期参数 date (YYYY-MM-DD)' });
    let courses;
    const cAccess = accessibleClause(req.teacher, 'c');
    let courseSql = `SELECT c.*, t.name as teacher_name FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id WHERE ${cAccess.sql} AND c.date = ?`;
    const courseParams = [...cAccess.params, date];
    const tf = resolveTeacherFilter(req.query.teacher_id);
    if (tf) { courseSql += ' AND ' + tf.sql; courseParams.push(...tf.params); }
    courseSql += ' ORDER BY c.teacher_id, c.start_time ASC';
    courses = db.prepare(courseSql).all(...courseParams);
    res.json({ data: courses });
  } catch (err) {
    console.error('获取课程失败:', err);
    res.status(500).json({ error: '获取课程失败' });
  }
});

// 获取日期范围内的课程
router.get('/api/courses/range', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({ error: '请提供 start_date 和 end_date 参数' });
    }
    let courses;
    const rAccess = accessibleClause(req.teacher, 'c');
    let rangeSql = `SELECT c.*, t.name as teacher_name FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id WHERE ${rAccess.sql} AND c.date BETWEEN ? AND ?`;
    const rangeParams = [...rAccess.params, start_date, end_date];
    const tf = resolveTeacherFilter(req.query.teacher_id);
    if (tf) { rangeSql += ' AND ' + tf.sql; rangeParams.push(...tf.params); }
    rangeSql += ' ORDER BY c.date ASC, c.start_time ASC';
    courses = db.prepare(rangeSql).all(...rangeParams);
    res.json({ data: courses });
  } catch (err) {
    console.error('获取课程范围失败:', err);
    res.status(500).json({ error: '获取课程范围失败' });
  }
});
// 创建新课
router.post('/api/courses', (req, res) => {
  try {
    let { student_id, student_name, date, start_time, end_time, color, description, grade, hourly_fee, attended, repeat_type, teacher_id } = req.body;
    if (!student_name || !date || !start_time || !end_time) {
      return res.status(400).json({ error: '请填写必要字段: student_name, date, start_time, end_time' });
    }
    if (feeError(hourly_fee)) return res.status(400).json({ error: feeError(hourly_fee) });

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

    // super_admin/manager 可以为其他教师创建课程
    let finalTeacherId = req.teacher.id;
    if (teacher_id && isSuperAdmin(req.teacher)) {
      finalTeacherId = parseInt(teacher_id);
    } else if (teacher_id && getRole(req.teacher) === 'manager') {
      const ok = db.prepare(`SELECT id FROM teachers WHERE id = ? AND managed_by = ?`).get(teacher_id, req.teacher.id);
      if (ok) finalTeacherId = parseInt(teacher_id);
    }

    // 先插入第一节课
    const result = db.prepare(
      `INSERT INTO courses (teacher_id, student_id, student_name, date, start_time, end_time, color, description, grade, hourly_fee, attended, repeat_type, repeat_weekdays, repeat_day_of_month, repeat_interval, repeat_unit, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      finalTeacherId, student_id, student_name, date, start_time, end_time,
      color || '#409EFF', description || '', grade || '', parseFloat(hourly_fee) || 0,
      attended ? 1 : 0, repeat_type || 'none',
      req.body.repeat_weekdays || null,
      req.body.repeat_day_of_month || null,
      Math.max(1, parseInt(req.body.repeat_interval) || 1),
      req.body.repeat_unit || null,
      req.body.end_date || null
    );

    const courseId = result.lastInsertRowid;

    // 如果是重复课程，把第一节课也加入组，并生成未来的课程
    if (repeat_type && repeat_type !== 'none') {
      db.prepare(`UPDATE courses SET repeat_group_id = ? WHERE id = ?`).run(courseId, courseId);
      const courseData = { student_name, grade, hourly_fee, attended, student_id };
      if (repeat_type === 'weekdays') {
        generateWeekdaysCourses(finalTeacherId, courseData, courseId, date, start_time, end_time, color, description, req.body.end_date);
      } else if (repeat_type === 'weekly' && !req.body.repeat_weekdays) {
        // 旧式每周：不带周几列表，维持原有按 7 天递增逻辑
        generateWeeklyCourses(finalTeacherId, courseData, courseId, date, start_time, end_time, color, description, req.body.end_date);
      } else {
        // weekly(多周几) / daily / biweekly / monthly / custom
        generateGenericRepeat(finalTeacherId, courseData, courseId, date, start_time, end_time, color, description, req.body);
      }
    }

    const courses = db.prepare(`SELECT * FROM courses WHERE repeat_group_id = ? OR id = ? ORDER BY date ASC`).all(courseId, courseId);
    res.status(201).json({ data: courses.length > 1 ? courses : courses[0] });
  } catch (err) {
    console.error('创建课程失败:', err);
    res.status(500).json({ error: '创建课程失败' });
  }
});

// 更新课程
router.put('/api/courses/:id', (req, res) => {
  try {
    const { id } = req.params;
    let existing;
    existing = db.prepare(`SELECT * FROM courses WHERE id = ?`).get(id);
    if (existing) {
      const cA = accessibleClause(req.teacher, 'c');
      const ok = db.prepare(`SELECT 1 as ok FROM courses c WHERE c.id = ? AND ${cA.sql}`).get(id, ...cA.params);
      if (!ok) existing = null;
    }
    if (!existing) return res.status(404).json({ error: '课程不存在或无权操作' });

    const { student_id, student_name, date, start_time, end_time, color, description, grade, hourly_fee, attended, repeat_type, update_all_future, teacher_id } = req.body;

    if (feeError(hourly_fee)) return res.status(400).json({ error: feeError(hourly_fee) });

    // 解析最终教师 id（super_admin/manager 可指定给其他教师）
    let finalTeacherId = existing.teacher_id || req.teacher.id;
    if (teacher_id && isSuperAdmin(req.teacher)) {
      finalTeacherId = parseInt(teacher_id);
    } else if (teacher_id && getRole(req.teacher) === 'manager') {
      const ok = db.prepare(`SELECT id FROM teachers WHERE id = ? AND managed_by = ?`).get(teacher_id, req.teacher.id);
      if (ok) finalTeacherId = parseInt(teacher_id);
    }

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
      const { end_date } = req.body;
      const startFrom = date || existing.date;
      const newRepeatType = repeat_type !== undefined ? repeat_type : existing.repeat_type;

      // 重复类型发生变化 → 删除未来课程，按新类型重新生成
      if (repeat_type !== undefined && repeat_type !== existing.repeat_type) {
        // 删除所有未来未签到课程（不含当前这节课，它的日期被重用为新组的首节）
        db.prepare(`DELETE FROM courses WHERE repeat_group_id = ? AND date > ? AND attended = 0`).run(groupId, startFrom);

        if (repeat_type === 'none') {
          // 改为不重复：当前课程脱离组
          db.prepare(
            `UPDATE courses SET student_name = ?, student_id = ?, date = ?, start_time = ?, end_time = ?,
             color = ?, description = ?, grade = ?, hourly_fee = ?, attended = ?, repeat_type = ?,
             repeat_group_id = NULL, end_date = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
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
            'none',
            id
          );
          const remaining = db.prepare(`SELECT * FROM courses WHERE repeat_group_id = ? ORDER BY date ASC`).all(groupId);
          return res.json({ data: remaining });
        }

        // 切换为 weekly 或 weekdays：更新当前课程 + 重新生成
        db.prepare(
          `UPDATE courses SET student_name = ?, student_id = ?, date = ?, start_time = ?, end_time = ?,
           color = ?, description = ?, grade = ?, hourly_fee = ?, attended = ?, repeat_type = ?,
           end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
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
          repeat_type,
          end_date || existing.end_date,
          id
        );

        // 更新整组的 end_date
        if (end_date !== undefined) {
          db.prepare(`UPDATE courses SET end_date = ? WHERE repeat_group_id = ?`).run(end_date || null, groupId);
        }

        // 按新类型重新生成未来课程
        const newEndDate = end_date !== undefined ? end_date : existing.end_date;
        const courseData = {
          student_name: finalName,
          grade: finalGrade,
          hourly_fee: hourly_fee !== undefined ? parseFloat(hourly_fee) : existing.hourly_fee,
          attended: 0,
          student_id: targetStudentId || existing.student_id
        };
        if (repeat_type === 'weekdays') {
          generateWeekdaysCourses(finalTeacherId, courseData, groupId, startFrom, start_time || existing.start_time, end_time || existing.end_time, color || existing.color, description !== undefined ? description : existing.description, newEndDate);
        } else if (repeat_type === 'weekly' && !req.body.repeat_weekdays) {
          // 旧式每周：不带周几列表，维持原有按 7 天递增逻辑
          generateWeeklyCourses(finalTeacherId, courseData, groupId, startFrom, start_time || existing.start_time, end_time || existing.end_time, color || existing.color, description !== undefined ? description : existing.description, newEndDate);
        } else {
          // weekly(多周几) / daily / biweekly / monthly / custom
          // 未传的重复参数沿用原课程的设置，避免切换/编辑时丢失间隔与周几
          const repeatOpts = {
            ...req.body,
            end_date: newEndDate,
            repeat_weekdays: req.body.repeat_weekdays !== undefined ? req.body.repeat_weekdays : existing.repeat_weekdays,
            repeat_day_of_month: req.body.repeat_day_of_month !== undefined ? req.body.repeat_day_of_month : existing.repeat_day_of_month,
            repeat_interval: req.body.repeat_interval !== undefined ? req.body.repeat_interval : existing.repeat_interval,
            repeat_unit: req.body.repeat_unit !== undefined ? req.body.repeat_unit : existing.repeat_unit
          };
          generateGenericRepeat(finalTeacherId, courseData, groupId, startFrom, start_time || existing.start_time, end_time || existing.end_time, color || existing.color, description !== undefined ? description : existing.description, repeatOpts);
        }

        const courses = db.prepare(`SELECT * FROM courses WHERE repeat_group_id = ? ORDER BY date ASC`).all(groupId);
        return res.json({ data: courses });
      }

      // 重复类型没变 → 维持原有逻辑
      if (end_date !== undefined) {
        db.prepare(
          `DELETE FROM courses WHERE repeat_group_id = ? AND date > ? AND date >= ? AND attended = 0`
        ).run(groupId, end_date, startFrom);
      }

      db.prepare(
        `UPDATE courses SET student_name = ?, student_id = ?, start_time = ?, end_time = ?,
         color = ?, description = ?, grade = ?, hourly_fee = ?, attended = ?, repeat_type = ?,
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
        newRepeatType,
        groupId,
        startFrom
      );

      if (end_date !== undefined) {
        db.prepare(`UPDATE courses SET end_date = ? WHERE repeat_group_id = ?`).run(end_date || null, groupId);
      }

      const courses = db.prepare(`SELECT * FROM courses WHERE repeat_group_id = ? ORDER BY date ASC`).all(groupId);
      return res.json({ data: courses });
    }

    // 单独更新这节课
    const endDateVal = req.body.end_date !== undefined ? req.body.end_date : existing.end_date;
    const finalRepeatType = repeat_type !== undefined ? repeat_type : existing.repeat_type;
    db.prepare(
      `UPDATE courses SET student_name = ?, student_id = ?, date = ?, start_time = ?, end_time = ?,
       color = ?, description = ?, grade = ?, hourly_fee = ?, attended = ?, repeat_type = ?,
       repeat_weekdays = ?, repeat_day_of_month = ?, repeat_interval = ?, repeat_unit = ?,
       end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
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
      finalRepeatType,
      req.body.repeat_weekdays !== undefined ? req.body.repeat_weekdays : existing.repeat_weekdays,
      req.body.repeat_day_of_month !== undefined ? req.body.repeat_day_of_month || null : existing.repeat_day_of_month,
      req.body.repeat_interval !== undefined ? Math.max(1, parseInt(req.body.repeat_interval) || 1) : existing.repeat_interval,
      req.body.repeat_unit !== undefined ? req.body.repeat_unit : existing.repeat_unit,
      endDateVal,
      id
    );
    // 如果改为不重复，脱离重复组
    if (finalRepeatType === 'none' && existing.repeat_group_id) {
      db.prepare(`UPDATE courses SET repeat_group_id = NULL WHERE id = ?`).run(id);
    }

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
router.delete('/api/courses/:id', (req, res) => {
  try {
    const { id } = req.params;
    let existing;
    existing = db.prepare(`SELECT * FROM courses WHERE id = ?`).get(id);
    if (existing) {
      const cA = accessibleClause(req.teacher, 'c');
      const ok = db.prepare(`SELECT 1 as ok FROM courses c WHERE c.id = ? AND ${cA.sql}`).get(id, ...cA.params);
      if (!ok) existing = null;
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
router.get('/api/courses/search', (req, res) => {
  try {
    const { student_name, grade, attended, page = 1, page_size = 20, start_date, end_date, teacher_id } = req.query;
    const conditions = [];
    const params = [];

    // 数据隔离
    const searchAccess = accessibleClause(req.teacher, 'c');
    conditions.push(searchAccess.sql);
    params.push(...searchAccess.params);

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
    const tf = resolveTeacherFilter(teacher_id);
    if (tf) { conditions.push(tf.sql); params.push(...tf.params); }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // 查询总数
    const countSql = `SELECT COUNT(*) as total FROM courses c ${whereClause}`;
    const { total } = db.prepare(countSql).get(...params);

    // 分页查询
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const selectSql = `SELECT c.*, t.name as teacher_name FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id ${whereClause} ORDER BY c.date DESC, c.start_time ASC LIMIT ? OFFSET ?`;

    const data = db.prepare(selectSql).all(...params, parseInt(page_size), offset);

    res.json({ data, total, page: parseInt(page), page_size: parseInt(page_size) });
  } catch (err) {
    console.error('搜索课程失败:', err);
    res.status(500).json({ error: '搜索失败' });
  }
});

// 统计数据（按周/月/年）
router.get('/api/courses/statistics', (req, res) => {
  try {
    const { group_by = 'month', start_date, end_date, teacher_id, managed_by } = req.query;

    let teacherCondition = '';
    const params = [];
    const statAccess = accessibleClause(req.teacher, 'c');
    if (statAccess.sql !== '1=1') {
      teacherCondition = 'AND ' + statAccess.sql;
      params.push(...statAccess.params);
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
    const tf = resolveTeacherFilter(teacher_id, 'c');
    if (tf) { dateFilter.push(tf.sql); params.push(...tf.params); }
    // managed_by → 展开为 teacher_id 列表
    let managedTeacherIds = null;
    if (managed_by) {
      const rows = db.prepare(`SELECT id FROM teachers WHERE managed_by = ?`).all(managed_by);
      if (rows.length > 0) {
        managedTeacherIds = rows.map(r => r.id);
        const ph = rows.map(() => '?').join(',');
        dateFilter.push('c.teacher_id IN (' + ph + ')');
        params.push(...managedTeacherIds);
      }
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
             SUM(CASE WHEN c.attended = 1 THEN 1 ELSE 0 END) as total_attended_courses,
             SUM(CASE WHEN c.attended = 1 THEN ${durationExpr} ELSE 0 END) / 60.0 as total_attended_hours,
             SUM(CASE WHEN c.attended = 1 THEN c.hourly_fee * ${durationExpr} / 60.0 ELSE 0 END) as total_attended_fee
      FROM courses c
      WHERE 1=1 ${teacherCondition} ${dateWhere}
    `;
    const totals = db.prepare(totalSql).get(...params);

    // 查预交余额总和（从 students 表，同样受 teacher 权限过滤）
    const stuAccess = accessibleClause(req.teacher, 's');
    let stuWhere = stuAccess.sql;
    let stuParams = [...stuAccess.params];
    const stf = resolveTeacherFilter(teacher_id, 's');
    if (stf) { stuWhere += ' AND ' + stf.sql; stuParams.push(...stf.params); }
    if (managedTeacherIds) {
      const ph = managedTeacherIds.map(() => '?').join(',');
      stuWhere += ' AND s.teacher_id IN (' + ph + ')';
      stuParams.push(...managedTeacherIds);
    }
    const prepaidRow = db.prepare(`SELECT COALESCE(SUM(s.prepaid_balance), 0) as total_prepaid FROM students s WHERE ${stuWhere}`).get(...stuParams);
    totals.total_prepaid = prepaidRow.total_prepaid;

    res.json({ data, totals });
  } catch (err) {
    console.error('统计失败:', err);
    res.status(500).json({ error: '统计失败' });
  }
});

module.exports = router;
