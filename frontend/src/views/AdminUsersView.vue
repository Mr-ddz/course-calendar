<template>
  <div class="admin-page">
    <header class="admin-header">
      <div class="admin-header-top">
        <h1 class="admin-title">👤 用户管理</h1>
        <div class="admin-user">
          <span class="admin-user-name">{{ teacherName }}</span>
          <el-button size="small" @click="handleLogout">退出</el-button>
        </div>
      </div>
      <div class="cal-tabs" style="margin-bottom: 10px; display: flex; gap: 6px;">
        <el-button size="small" @click="$router.push('/calendar')">📅 月历</el-button>
        <el-button size="small" @click="$router.push('/statistics')">📊 统计</el-button>
        <el-button size="small" type="primary">👤 用户管理</el-button>
      </div>
      <div class="admin-toolbar">
        <div class="admin-toolbar-left">
          <span class="admin-count">共 {{ teachers.length }} 位教师</span>
        </div>
        <el-button type="primary" size="small" @click="showAddDialog = true">+ 添加教师</el-button>
      </div>
    </header>

    <div class="admin-table-wrapper">
      <el-table :data="teachers" stripe style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="email" label="邮箱" min-width="180">
          <template #default="{ row }">
            <span v-if="row.email">{{ row.email }}</span>
            <span v-else class="no-email">—</span>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="100">
          <template #default="{ row }">
            <el-tag :type="row.source === 'admin' ? '' : 'warning'" size="small">
              {{ row.source === 'admin' ? '管理员创建' : '邮箱注册' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : (row.status === 'pending' ? 'warning' : 'danger')" size="small">
              {{ row.status === 'active' ? '正常' : (row.status === 'pending' ? '申请中' : '禁用') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button v-if="row.status === 'pending'" type="success" size="small" @click="approveUser(row)">通过</el-button>
            <el-button v-if="row.status === 'pending'" type="danger" size="small" @click="rejectUser(row)">拒绝</el-button>
            <el-button v-if="row.status === 'active' && row.id !== 1" type="danger" size="small" plain @click="toggleStatus(row, 'disabled')">禁用</el-button>
            <el-button v-if="row.status === 'disabled'" type="success" size="small" plain @click="toggleStatus(row, 'active')">启用</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 添加教师对话框 -->
    <el-dialog v-model="showAddDialog" title="添加教师" width="420px" destroy-on-close @closed="resetAddForm">
      <el-form ref="addFormRef" :model="addForm" :rules="addRules" label-width="80px" size="large">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="addForm.name" placeholder="如：张老师" />
        </el-form-item>
        <el-form-item label="用户名" prop="username">
          <el-input v-model="addForm.username" placeholder="用于登录" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="addForm.password" type="password" placeholder="初始密码" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="adding" @click="handleAddTeacher">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminGetTeachers, adminAddTeacher, adminUpdateTeacher, logout as logoutApi } from '../api/index.js'

const router = useRouter()
const teacherInfo = JSON.parse(localStorage.getItem('teacher') || '{}')
const teacherName = teacherInfo.name || ''

const teachers = ref([])
const loading = ref(false)
const showAddDialog = ref(false)
const adding = ref(false)
const addFormRef = ref(null)
const addForm = ref({ name: '', username: '', password: '' })
const addRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function loadTeachers() {
  loading.value = true
  try {
    const res = await adminGetTeachers()
    teachers.value = res.data.data || []
  } catch (err) {
    if (err.response?.status === 403) router.push('/calendar')
    ElMessage.error('加载失败')
  } finally { loading.value = false }
}

async function handleAddTeacher() {
  const valid = await addFormRef.value?.validate().catch(() => false)
  if (!valid) return
  adding.value = true
  try {
    await adminAddTeacher(addForm.value)
    ElMessage.success('教师已添加')
    showAddDialog.value = false
    loadTeachers()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '添加失败')
  } finally { adding.value = false }
}

async function toggleStatus(row, status) {
  try {
    const action = status === 'disabled' ? '禁用' : '启用'
    await ElMessageBox.confirm(`确定要${action}「${row.name}」吗？`, '确认', { type: 'warning' })
    await adminUpdateTeacher(row.id, { status })
    ElMessage.success(`${action}成功`)
    loadTeachers()
  } catch { /* cancel */ }
}

async function approveUser(row) {
  try {
    await ElMessageBox.confirm(`确定通过「${row.name}」的注册申请吗？`, '审核', { type: 'info' })
    await adminUpdateTeacher(row.id, { status: 'active' })
    ElMessage.success('已通过')
    loadTeachers()
  } catch { /* cancel */ }
}

async function rejectUser(row) {
  try {
    await ElMessageBox.confirm(`确定拒绝「${row.name}」的注册申请吗？\n该用户将被删除。`, '审核', { type: 'warning' })
    await adminUpdateTeacher(row.id, { status: 'disabled' })
    ElMessage.success('已拒绝')
    loadTeachers()
  } catch { /* cancel */ }
}

function resetAddForm() {
  addForm.value = { name: '', username: '', password: '' }
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确认退出登录？', '退出', { type: 'info' })
    try { await logoutApi() } catch { /* ignore */ }
    localStorage.removeItem('token')
    localStorage.removeItem('teacher')
    router.push('/login')
  } catch { /* cancel */ }
}

onMounted(() => { loadTeachers() })
</script>

<style scoped>
.beian-footer { text-align: center; padding: 16px 20px; font-size: 11px; }
.beian-footer a { color: #bbb; text-decoration: none; }

.admin-page {
  max-width: 960px; margin: 0 auto; min-height: 100vh;
  background: #f5f7fa; display: flex; flex-direction: column;
}
.admin-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff; padding: 16px 20px 12px;
}
.admin-header-top {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;
}
.admin-title { font-size: 20px; font-weight: 700; letter-spacing: 1px; }
.admin-user { display: flex; align-items: center; gap: 8px; }
.admin-user-name {
  font-size: 13px; background: rgba(255,255,255,0.15);
  padding: 3px 12px; border-radius: 20px;
}
.admin-user .el-button {
  --el-button-bg-color: rgba(255,255,255,0.1);
  --el-button-border-color: rgba(255,255,255,0.3);
  --el-button-text-color: rgba(255,255,255,0.8);
  --el-button-hover-bg-color: rgba(245,108,108,0.3);
  --el-button-hover-border-color: #f56c6c;
  --el-button-hover-text-color: #fff;
}
.cal-tabs .el-button {
  --el-button-bg-color: rgba(255,255,255,0.15);
  --el-button-border-color: rgba(255,255,255,0.3);
  --el-button-text-color: #fff;
  --el-button-hover-bg-color: rgba(255,255,255,0.25);
}
.admin-toolbar {
  display: flex; align-items: center; justify-content: space-between; margin-top: 6px;
}
.admin-count { font-size: 13px; opacity: 0.8; }
.admin-toolbar .el-button--primary {
  --el-button-bg-color: #fff; --el-button-text-color: #667eea; --el-button-border-color: #fff;
}
.admin-table-wrapper {
  background: #fff; margin: 0; padding: 20px; flex: 1;
}
.no-email { color: #ccc; }
</style>
