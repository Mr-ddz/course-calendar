const db = require('../database');
const { isWorkdayOrHoliday } = require('./holidays');

// ===== 辅助函数：生成未来每周重复课程 =====


const MAX_WEEKS = 52;
function generateWeeklyCourses(teacherId, courseData, firstInsertId, startDateStr, start_time, end_time, color, description, endDateStr) {
  const { student_name, grade, hourly_fee, attended, student_id } = courseData;
  const startDate = new Date(startDateStr);
  const insertStmt = db.prepare(
    `INSERT INTO courses (teacher_id, student_id, student_name, date, start_time, end_time, color, description, grade, hourly_fee, attended, repeat_type, repeat_group_id, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'weekly', ?, ?)`
  );

  const maxDate = endDateStr ? new Date(endDateStr) : null;
  const created = [{ id: firstInsertId, date: startDateStr }];
  for (let w = 1; w <= MAX_WEEKS; w++) {
    const nextDate = new Date(startDate);
    nextDate.setDate(nextDate.getDate() + w * 7);
    const dateStr = nextDate.toISOString().split('T')[0];
    if (maxDate && nextDate > maxDate) break;
    const result = insertStmt.run(teacherId, student_id || null, student_name, dateStr, start_time, end_time, color || '#409EFF', description || '', grade || '', parseFloat(hourly_fee) || 0, attended ? 1 : 0, firstInsertId, endDateStr || null);
    created.push({ id: result.lastInsertRowid, date: dateStr });
  }
  return created;
}

// ===== 辅助函数：生成每周工作日重复课程 =====
function generateWeekdaysCourses(teacherId, courseData, firstInsertId, startDateStr, start_time, end_time, color, description, endDateStr) {
  const { student_name, grade, hourly_fee, attended, student_id } = courseData;
  const insertStmt = db.prepare(
    `INSERT INTO courses (teacher_id, student_id, student_name, date, start_time, end_time, color, description, grade, hourly_fee, attended, repeat_type, repeat_group_id, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'weekdays', ?, ?)`
  );

  const startDate = new Date(startDateStr);
  const maxDate = endDateStr ? new Date(endDateStr) : new Date(startDate);
  if (!endDateStr) maxDate.setDate(maxDate.getDate() + MAX_WEEKS * 7); // 默认约52周后

  const created = [{ id: firstInsertId, date: startDateStr }];
  let current = new Date(startDate);
  let count = 0;
  const MAX_COURSES = 365; // 工作日最多生成一年的量

  while (count < MAX_COURSES) {
    current.setDate(current.getDate() + 1);
    const dateStr = current.toISOString().split('T')[0];
    const dow = current.getDay();
    if (current > maxDate) break;

    let shouldCreate = false;
    // 周一~周五正常创建
    if (dow >= 1 && dow <= 5) shouldCreate = true;

    // 检查节假日/调休
    const hd = isWorkdayOrHoliday(dateStr);
    if (hd === 'holiday') shouldCreate = false;   // 法定假日跳过
    if (hd === 'workday') shouldCreate = true;    // 调休补班（可能周末）创建

    if (shouldCreate) {
      const result = insertStmt.run(teacherId, student_id || null, student_name, dateStr, start_time, end_time, color || '#409EFF', description || '', grade || '', parseFloat(hourly_fee) || 0, attended ? 1 : 0, firstInsertId, endDateStr || null);
      created.push({ id: result.lastInsertRowid, date: dateStr });
      count++;
    }
  }

  if (count >= MAX_COURSES) {
    console.log(`⚠️ 工作日课程已超过上限 ${MAX_COURSES} 节，请检查截止日期`);
  }
  return created;
}


// ===== 辅助函数：通用重复生成（daily / biweekly / monthly / custom / weekly多周几） =====
function generateGenericRepeat(teacherId, courseData, firstInsertId, startDateStr, start_time, end_time, color, description, opts) {
  const { student_name, grade, hourly_fee, attended, student_id } = courseData;
  const repeat_type = opts.repeat_type || 'custom';
  const repeat_weekdays = opts.repeat_weekdays || null;                     // 如 "1,3" 周几列表（周一=1..周日=7）
  const repeat_day_of_month = opts.repeat_day_of_month || null;             // 原样保存（可 "1,5,7" 多选）
  const daysOfMonth = repeat_day_of_month ? String(repeat_day_of_month).split(',').map(n => parseInt(n)).filter(n => n >= 1 && n <= 31) : null; // 每月第几日列表
  const repeat_interval = Math.max(1, parseInt(opts.repeat_interval) || 1); // 间隔 N
  const repeat_unit = opts.repeat_unit || null;                             // day/week/month
  const endDateStr = opts.end_date || null;
  const weekdays = repeat_weekdays ? repeat_weekdays.split(',').map(Number) : null;

  const insertStmt = db.prepare(
    `INSERT INTO courses (teacher_id, student_id, student_name, date, start_time, end_time, color, description, grade, hourly_fee, attended, repeat_type, repeat_group_id, end_date, repeat_weekdays, repeat_day_of_month, repeat_interval, repeat_unit)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const runInsert = (dateStr) => insertStmt.run(
    teacherId, student_id || null, student_name, dateStr, start_time, end_time,
    color || '#409EFF', description || '', grade || '', parseFloat(hourly_fee) || 0,
    attended ? 1 : 0, repeat_type, firstInsertId, endDateStr || null,
    repeat_weekdays, repeat_day_of_month, repeat_interval, repeat_unit
  );

  const startDate = new Date(startDateStr);
  const maxDate = endDateStr ? new Date(endDateStr) : new Date(startDate);
  if (!endDateStr) maxDate.setDate(maxDate.getDate() + MAX_WEEKS * 7);

  const created = [{ id: firstInsertId, date: startDateStr }];

  // 计算下一个重复日期
  function nextDate(from, prevDate) {
    const d = prevDate ? new Date(prevDate) : new Date(from);

    // 每天 / 自定义按天：间隔 N 天
    if (repeat_type === 'daily' || (repeat_type === 'custom' && repeat_unit === 'day')) {
      d.setDate(d.getDate() + repeat_interval);
      return d;
    }

    // 每月第 N 日 / 自定义按月（可多选 1-31 号）：间隔 N 月，某月没有该日则跳过该月
    if (repeat_type === 'monthly' || (repeat_type === 'custom' && repeat_unit === 'month')) {
      const days = daysOfMonth && daysOfMonth.length > 0 ? daysOfMonth : [d.getDate()];
      // 周期序号 = 相对开始月的第几个 N 月周期（从 0 开始）
      const startYearMonth = from.getFullYear() * 12 + from.getMonth();
      const base = prevDate ? new Date(prevDate) : new Date(from);
      const baseYearMonth = base.getFullYear() * 12 + base.getMonth();
      const periodIndex = Math.floor((baseYearMonth - startYearMonth) / repeat_interval);
      for (let attempt = 0; attempt < 24; attempt++) {
        const period = periodIndex + attempt;
        const targetYearMonth = startYearMonth + period * repeat_interval;
        const y = Math.floor(targetYearMonth / 12);
        const m = targetYearMonth % 12;
        // 用 UTC 构造，避免 toISOString 时区偏移
        const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getDate();
        const validDays = days.filter(dd => dd <= daysInMonth).sort((a, b) => a - b);
        for (const day of validDays) {
          const candidate = new Date(Date.UTC(y, m, day));
          if (candidate > base) return candidate;
        }
      }
      d.setDate(d.getDate() + 1); // 极端情况下至少前进一天
      return d;
    }

    // 周 / 双周 / 自定义按周：每 N 周的选定周几循环
    if (!weekdays || weekdays.length === 0) {
      d.setDate(d.getDate() + 7 * repeat_interval);
      return d;
    }
    // 以开始日所在周一为第 0 周基准，只取第 0, N, 2N... 周内的选定周几
    const startMon = new Date(from);
    startMon.setDate(startMon.getDate() - ((startMon.getDay() === 0 ? 7 : startMon.getDay()) - 1));
    const base = prevDate ? new Date(prevDate) : new Date(from);
    for (let i = 1; i <= 7 * repeat_interval; i++) {
      const check = new Date(base);
      check.setDate(base.getDate() + i);
      const dow = check.getDay() === 0 ? 7 : check.getDay();
      if (!weekdays.includes(dow)) continue;
      const checkMon = new Date(check);
      checkMon.setDate(checkMon.getDate() - ((checkMon.getDay() === 0 ? 7 : checkMon.getDay()) - 1));
      const weekDiff = Math.round((checkMon - startMon) / (7 * 24 * 3600 * 1000));
      if (weekDiff % repeat_interval === 0) return check;
    }
    d.setDate(d.getDate() + 7 * repeat_interval);
    return d;
  }

  let prev = null;
  let count = 0;
  const MAX_COURSES = 1000;
  while (count < MAX_COURSES) {
    const nd = nextDate(startDate, prev);
    if (nd > maxDate) break;
    const dateStr = nd.toISOString().split('T')[0];
    const result = runInsert(dateStr);
    created.push({ id: result.lastInsertRowid, date: dateStr });
    prev = nd;
    count++;
  }
  if (count >= MAX_COURSES) {
    console.log(`⚠️ 重复课程生成超过上限 ${MAX_COURSES} 节，已停止（请检查截止日期）`);
  }
  return created;
}

module.exports = { MAX_WEEKS, generateWeeklyCourses, generateWeekdaysCourses, generateGenericRepeat };
