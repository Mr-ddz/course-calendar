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
    student_id: "INTEGER DEFAULT NULL",
    end_date: "TEXT DEFAULT NULL"
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
    `INSERT INTO teachers (name, password) VALUES (?, ?)`
  ).run('管理员', hash);
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

// ========== 4. 学生表新字段迁移（预交费支持） ==========
const studentCols = db.prepare(`SELECT name FROM pragma_table_info('students')`).all().map(r => r.name);
const studentNewFields = {
  hourly_fee: "REAL DEFAULT 0",
  payment_mode: "TEXT DEFAULT 'settle'",
  prepaid_balance: "REAL DEFAULT 0"
};
for (const [name, def] of Object.entries(studentNewFields)) {
  if (!studentCols.includes(name)) {
    db.exec(`ALTER TABLE students ADD COLUMN ${name} ${def}`);
  }
}

// ========== 5. 预交费流水表 ==========
const transactionsExist = db.prepare(
  `SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='prepaid_transactions'`
  ).get()?.cnt > 0;

if (!transactionsExist) {
  db.exec(`
    CREATE TABLE prepaid_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      balance_after REAL NOT NULL,
      type TEXT NOT NULL,
      course_id INTEGER DEFAULT NULL,
      note TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_student ON prepaid_transactions(student_id)`);
}

// ========== 6. 一次性迁移：从课程记录同步 hourly_fee 到学生表 ==========
// 新加 hourly_fee 字段后，把学生最近一次课程的价格抄过来，避免线上数据全为 0
const hasFeeCol = db.prepare(`SELECT COUNT(*) as cnt FROM pragma_table_info('students') WHERE name='hourly_fee'`).get().cnt > 0;
if (hasFeeCol) {
  const zeroCount = db.prepare(`SELECT COUNT(*) as cnt FROM students WHERE hourly_fee = 0`).get().cnt;
  if (zeroCount > 0) {
    const rows = db.prepare(`
      SELECT s.id,
        (SELECT hourly_fee FROM courses WHERE student_id = s.id AND hourly_fee > 0 ORDER BY date DESC, id DESC LIMIT 1) as fee
      FROM students s WHERE s.hourly_fee = 0
    `).all();
    let updated = 0;
    for (const r of rows) {
      if (r.fee && r.fee > 0) {
        db.prepare(`UPDATE students SET hourly_fee = ? WHERE id = ?`).run(r.fee, r.id);
        updated++;
      }
    }
    if (updated > 0) {
      console.log(`📦 已从课程记录同步 ${updated} 名学生的课时单价`);
    }
  }
}

// ========== 7. 教师表角色字段迁移（要在删除 username 之前执行，确保字段存在） ==========
const teacherColsMigration = db.prepare(`SELECT name FROM pragma_table_info('teachers')`).all().map(r => r.name);
const roleFields = {
  role: "TEXT DEFAULT 'teacher'",
  managed_by: "INTEGER DEFAULT NULL"
};
for (const [name, def] of Object.entries(roleFields)) {
  if (!teacherColsMigration.includes(name)) {
    db.exec(`ALTER TABLE teachers ADD COLUMN ${name} ${def}`);
  }
}
// 将 admin (id=1) 设为 super_admin
const adminUpdate = db.prepare(`UPDATE teachers SET role = 'super_admin' WHERE id = 1 AND role = 'teacher'`).run();
if (adminUpdate.changes > 0) {
  console.log(`👑 已将管理员账号设为 super_admin`);
}

// ========== 8. 删除 username 字段（SQLite 不支持直接 DROP UNIQUE 列，需要重建表） ==========
const hasUsernameCol = db.prepare(`SELECT COUNT(*) as cnt FROM pragma_table_info('teachers') WHERE name='username'`).get().cnt > 0;
if (hasUsernameCol) {
  db.pragma('foreign_keys = OFF');
  db.exec(`
    CREATE TABLE teachers_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      token TEXT,
      email TEXT DEFAULT '',
      source TEXT DEFAULT 'admin',
      status TEXT DEFAULT 'active',
      role TEXT DEFAULT 'teacher',
      managed_by INTEGER DEFAULT NULL,
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
  // 先查询当前所有列名，动态构建 INSERT
  const existingCols = db.prepare(`SELECT name FROM pragma_table_info('teachers')`).all().map(r => r.name);
  const skipCols = ['username'];
  const copyCols = existingCols.filter(c => !skipCols.includes(c));
  const colList = copyCols.join(', ');
  db.exec(`INSERT INTO teachers_new (${colList}) SELECT ${colList} FROM teachers`);
  db.exec(`DROP TABLE teachers`);
  db.exec(`ALTER TABLE teachers_new RENAME TO teachers`);
  db.pragma('foreign_keys = ON');
  console.log(`🗑️ 已删除 teachers 表的 username 字段`);
}

module.exports = db;
