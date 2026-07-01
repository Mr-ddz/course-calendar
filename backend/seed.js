/**
 * 教师管理脚本
 *
 * 用法：
 *   node seed.js list                    — 查看所有教师
 *   node seed.js add 张三 zhangsan 123456  — 添加教师
 *   node seed.js delete 2                 — 删除 id=2 的教师
 *   node seed.js reset-password admin admin123  — 重置密码
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const DB_DIR = process.env.DB_DIR || __dirname;
const db = new Database(path.join(DB_DIR, 'schedule.db'));

const command = process.argv[2];

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

if (command === 'list') {
  const teachers = db.prepare(`SELECT id, name, username, created_at FROM teachers ORDER BY id`).all();
  console.log('\n📋 教师列表：');
  console.log('─'.repeat(60));
  teachers.forEach(t => {
    console.log(`  ${t.id} | ${t.name} | ${t.username} | 创建于 ${t.created_at}`);
  });
  if (!teachers.length) console.log('  (暂无教师)');
  console.log();

} else if (command === 'add') {
  const name = process.argv[3];
  const username = process.argv[4];
  const password = process.argv[5];

  if (!name || !username || !password) {
    console.error('用法: node seed.js add "姓名" "用户名" "密码"');
    process.exit(1);
  }

  try {
    db.prepare(`INSERT INTO teachers (name, username, password) VALUES (?, ?, ?)`)
      .run(name, username, hashPassword(password));
    console.log(`✅ 教师 "${name}" (${username}) 创建成功！`);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      console.error(`❌ 用户名 "${username}" 已存在`);
    } else {
      console.error('❌ 创建失败:', err.message);
    }
  }

} else if (command === 'delete') {
  const id = parseInt(process.argv[3]);
  if (!id) {
    console.error('用法: node seed.js delete <id>');
    process.exit(1);
  }

  const teacher = db.prepare(`SELECT * FROM teachers WHERE id = ?`).get(id);
  if (!teacher) {
    console.error(`❌ id=${id} 的教师不存在`);
    process.exit(1);
  }

  // 同时删除该教师的所有课程
  db.prepare(`DELETE FROM courses WHERE teacher_id = ?`).run(id);
  db.prepare(`DELETE FROM teachers WHERE id = ?`).run(id);
  console.log(`✅ 已删除教师 "${teacher.name}" 及其所有课程`);

} else if (command === 'reset-password') {
  const username = process.argv[3];
  const newPassword = process.argv[4];
  if (!username || !newPassword) {
    console.error('用法: node seed.js reset-password "用户名" "新密码"');
    process.exit(1);
  }

  const result = db.prepare(`UPDATE teachers SET password = ?, token = NULL WHERE username = ?`)
    .run(hashPassword(newPassword), username);
  if (result.changes > 0) {
    console.log(`✅ 用户 "${username}" 密码已重置（所有已登录会话已失效）`);
  } else {
    console.error(`❌ 用户 "${username}" 不存在`);
  }

} else {
  console.log(`
📚 教师管理脚本

  查看教师        node seed.js list
  添加教师        node seed.js add "姓名" "用户名" "密码"
  删除教师        node seed.js delete <id>
  重置密码        node seed.js reset-password "用户名" "新密码"

  示例：
    node seed.js add "张三" "zhangsan" "123456"
    node seed.js add "李四" "lisi" "654321"
    node seed.js list
`);
}
