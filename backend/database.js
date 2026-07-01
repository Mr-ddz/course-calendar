const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_DIR = process.env.DB_DIR || __dirname;
const DB_PATH = path.join(DB_DIR, 'schedule.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

// ========== 1. 课程表（含迁移兼容） ==========
const tableExists = db.prepare(
  `SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='courses'`
).get()?.cnt > 0;

if (tableExists) {
  const colNames = db.prepare(`SELECT name FROM pragma_table_info('courses')`).all().map(r => r.name);

  // 旧表：title → student_name 迁移
  if (colNames.includes('title') && !colNames.includes('student_name')) {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      CREATE TABLE courses_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id INTEGER NOT NULL DEFAULT 1,
        student_name TEXT NOT NULL DEFAULT '',
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        color TEXT DEFAULT '#409EFF',
        description TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO courses_new (id, teacher_id, student_name, date, start_time, end_time, color, description, created_at, updated_at)
        SELECT id, 1, title, date, start_time, end_time, color, description, created_at, updated_at FROM courses;
      DROP TABLE courses;
      ALTER TABLE courses_new RENAME TO courses;
    `);
    db.pragma('foreign_keys = ON');
  }
  // 已有 student_name 但无 teacher_id：加列
  else if (!colNames.includes('teacher_id')) {
    db.exec(`ALTER TABLE courses ADD COLUMN teacher_id INTEGER NOT NULL DEFAULT 1`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_id)`);
  }
} else {
  // 全新创建
  db.exec(`
    CREATE TABLE courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL DEFAULT 1,
      student_name TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      color TEXT DEFAULT '#409EFF',
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_id)`);
}

db.exec(`CREATE INDEX IF NOT EXISTS idx_courses_date ON courses(date)`);

// ========== 2. 教师表 ==========
const teachersExist = db.prepare(
  `SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='teachers'`
  ).get()?.cnt > 0;

if (!teachersExist) {
  db.exec(`
    CREATE TABLE teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建默认管理员账号（密码: admin123）
  const hash = crypto.createHash('sha256').update('admin123').digest('hex');
  db.prepare(
    `INSERT INTO teachers (name, username, password) VALUES (?, ?, ?)`
  ).run('管理员', 'admin', hash);
}

module.exports = db;
