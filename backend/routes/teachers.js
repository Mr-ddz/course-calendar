const express = require('express');
const db = require('../database');
const { getRole, isSuperAdmin } = require('../services/access');

const router = express.Router();

// GET /api/teachers — 获取所有教师列表（仅返回正常状态的教师）
router.get("/api/teachers", (req, res) => {
  try {
    let teachers;
    if (isSuperAdmin(req.teacher)) {
      const { managed_by } = req.query;
      if (managed_by) {
        teachers = db.prepare(`SELECT t.id, t.name, t.role, t.managed_by, (SELECT m.name FROM teachers m WHERE m.id = t.managed_by) as manager_name FROM teachers t WHERE t.managed_by = ? AND t.role != 'super_admin' AND t.status = 'active' ORDER BY t.id`).all(managed_by);
      } else {
        teachers = db.prepare(`SELECT t.id, t.name, t.role, t.managed_by, (SELECT m.name FROM teachers m WHERE m.id = t.managed_by) as manager_name FROM teachers t WHERE t.role != 'super_admin' AND t.status = 'active' ORDER BY t.id`).all();
      }
    } else if (getRole(req.teacher) === "manager") {
      teachers = db.prepare(`SELECT t.id, t.name, t.role, t.managed_by, (SELECT m.name FROM teachers m WHERE m.id = t.managed_by) as manager_name FROM teachers t WHERE t.managed_by = ? AND t.status = 'active' ORDER BY t.id`).all(req.teacher.id);
    } else {
      teachers = [{ id: req.teacher.id, name: req.teacher.name, role: req.teacher.role || "teacher", managed_by: null }];
    }
    res.json({ data: teachers });
  } catch (err) {
    console.error("获取教师列表失败:", err);
    res.status(500).json({ error: "获取失败" });
  }
});

module.exports = router;
