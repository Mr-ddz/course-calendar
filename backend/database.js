const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const DB_DIR = process.env.DB_DIR || path.join(__dirname, 'data');

// 确保数据库目录存在
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const DB_PATH = path.join(DB_DIR, 'schedule.db');

// 迁移旧数据库（兼容旧版本，数据库在 backend/ 下）
const OLD_PATH = path.join(__dirname, 'schedule.db');
if (!fs.existsSync(DB_PATH) && fs.existsSync(OLD_PATH)) {
  fs.copyFileSync(OLD_PATH, DB_PATH);
  console.log('📦 已迁移数据库到:', DB_PATH);
}

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
        student_id INTEGER DEFAULT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        color TEXT DEFAULT '#409EFF',
        description TEXT DEFAULT '',
        grade TEXT DEFAULT '',
        hourly_fee REAL DEFAULT 0,
        attended INTEGER DEFAULT 0,
        repeat_type TEXT DEFAULT 'none',
        repeat_group_id INTEGER DEFAULT NULL,
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

  // 补充缺失的字段
  const fieldDefs = {
    grade: "TEXT DEFAULT ''",
    hourly_fee: "REAL DEFAULT 0",
    attended: "INTEGER DEFAULT 0",
    repeat_type: "TEXT DEFAULT 'none'",
    repeat_group_id: "INTEGER DEFAULT NULL",
    student_id: "INTEGER DEFAULT NULL"
  };
  for (const [name, def] of Object.entries(fieldDefs)) {
    if (!colNames.includes(name)) {
      db.exec(`ALTER TABLE courses ADD COLUMN ${name} ${def}`);
    }
  }
} else {
  // 全新创建
  db.exec(`
    CREATE TABLE courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL DEFAULT 1,
      student_name TEXT NOT NULL,
      student_id INTEGER DEFAULT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      color TEXT DEFAULT '#409EFF',
      description TEXT DEFAULT '',
      grade TEXT DEFAULT '',
      hourly_fee REAL DEFAULT 0,
      attended INTEGER DEFAULT 0,
      repeat_type TEXT DEFAULT 'none',
      repeat_group_id INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_id)`);
}

db.exec(`CREATE INDEX IF NOT EXISTS idx_courses_date ON courses(date)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_courses_student ON courses(student_id)`);

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
      email TEXT DEFAULT '',
      source TEXT DEFAULT 'admin',
      status TEXT DEFAULT 'active',
      last_login_at TEXT DEFAULT NULL,
      last_logout_at TEXT DEFAULT NULL,
      token_expires_at TEXT DEFAULT NULL,
      refresh_token TEXT DEFAULT NULL,
      refresh_token_expires_at TEXT DEFAULT NULL,
      reset_token TEXT DEFAULT NULL,
      reset_token_expires_at TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const hash = crypto.createHash('sha256').update('admin123').digest('hex');
  db.prepare(
    `INSERT INTO teachers (name, username, password) VALUES (?, ?, ?)`
  ).run('管理员', 'admin', hash);
} else {
  // 兼容旧表：补充字段
  const teacherCols = db.prepare(`SELECT name FROM pragma_table_info('teachers')`).all().map(r => r.name);
  const teacherFields = {
    email: "TEXT DEFAULT ''",
    source: "TEXT DEFAULT 'admin'",
    status: "TEXT DEFAULT 'active'",
    last_login_at: "TEXT DEFAULT NULL",
    last_logout_at: "TEXT DEFAULT NULL",
    token_expires_at: "TEXT DEFAULT NULL",
    refresh_token: "TEXT DEFAULT NULL",
    refresh_token_expires_at: "TEXT DEFAULT NULL",
    reset_token: "TEXT DEFAULT NULL",
    reset_token_expires_at: "TEXT DEFAULT NULL"
  };
  for (const [name, def] of Object.entries(teacherFields)) {
    if (!teacherCols.includes(name)) {
      db.exec(`ALTER TABLE teachers ADD COLUMN ${name} ${def}`);
    }
  }
}

// ========== 3. 学生表 ==========
const studentsExist = db.prepare(
  `SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='students'`
).get()?.cnt > 0;

if (!studentsExist) {
  db.exec(`
    CREATE TABLE students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      grade TEXT DEFAULT '',
      teacher_id INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_students_teacher ON students(teacher_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_students_name ON students(name)`);

  // 迁移已有课程中的学生数据到 students 表
  const existingStudents = db.prepare(
    `SELECT DISTINCT student_name, grade, teacher_id FROM courses WHERE student_name != ''`
  ).all();

  if (existingStudents.length > 0) {
    const insertStudent = db.prepare(
      `INSERT INTO students (name, grade, teacher_id) VALUES (?, ?, ?)`
    );
    const updateCourse = db.prepare(
      `UPDATE courses SET student_id = ? WHERE student_name = ? AND teacher_id = ? AND (student_id IS NULL OR student_id = 0)`
    );

    for (const s of existingStudents) {
      const result = insertStudent.run(s.student_name, s.grade || '', s.teacher_id);
      updateCourse.run(result.lastInsertRowid, s.student_name, s.teacher_id);
    }
  }
}

module.exports = db;
