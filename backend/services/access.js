const db = require('../database');

const ADMIN_ID = 1;
function isAdmin(user) { return user.id === ADMIN_ID; }
function getRole(user) { return user.role || 'teacher'; }
function isSuperAdmin(user) { return getRole(user) === 'super_admin'; }
// 单价允许为 0，但不可为负数；返回 null 表示无问题，否则为错误信息
function feeError(hourly_fee) {
  if (hourly_fee !== undefined && hourly_fee !== null && hourly_fee !== '' && parseFloat(hourly_fee) < 0) {
    return '单价不能为负数';
  }
  return null;
}
function accessibleClause(user, tableAlias) {
  const t = tableAlias || 'c';
  if (isAdmin(user) || isSuperAdmin(user)) return { sql: '1=1', params: [] };
  if (getRole(user) === 'manager') {
    const ids = db.prepare(`SELECT id FROM teachers WHERE managed_by = ?`).all(user.id).map(r => r.id);
    ids.push(user.id); // 包含管理员自己的课程
    return { sql: `${t}.teacher_id IN (${ids.map(() => '?').join(',')})`, params: ids };
  }
  return { sql: `${t}.teacher_id = ?`, params: [user.id] };
}

// 展开教师筛选：如果是管理员，展开为其名下所有教师的 IN 条件
function resolveTeacherFilter(teacherId, alias) {
  const a = alias || "c";
  if (!teacherId) return null;
  const target = db.prepare(`SELECT id, role FROM teachers WHERE id = ?`).get(teacherId);
  if (!target) return null;
  if (target.role === "manager") {
    const ids = db.prepare(`SELECT id FROM teachers WHERE managed_by = ?`).all(target.id).map(r => r.id);
    ids.push(target.id); // 包含管理员自己的课程
    return { sql: `${a}.teacher_id IN (${ids.map(() => "?").join(",")})`, params: ids };
  }
  return { sql: `${a}.teacher_id = ?`, params: [parseInt(teacherId)] };
}

module.exports = { ADMIN_ID, isAdmin, getRole, isSuperAdmin, feeError, accessibleClause, resolveTeacherFilter };
