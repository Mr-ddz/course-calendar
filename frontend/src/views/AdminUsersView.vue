<template>
  <div class="admin-page">
    <header class="admin-header">
      <div class="admin-header-top">
        <h1 class="admin-title"><el-icon><UserFilled /></el-icon> 用户管理</h1>
      </div>
      <div class="admin-toolbar">
        <div class="admin-toolbar-left">
          <span class="admin-count">共 {{ total }} 位用户</span>
        </div>
        <el-button type="primary" size="small" @click="openAddDialog">+ {{ isSuperAdmin ? '添加用户' : '添加教师' }}</el-button>
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
        <el-table-column label="角色" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.id === 1" type="danger" size="small">超级管理员</el-tag>
            <el-tag v-else-if="row.role === 'manager'" type="warning" size="small">管理员</el-tag>
            <el-tag v-else type="info" size="small">教师</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" width="160">
          <template #default="{ row }">
            {{ row.created_at || '—' }}
          </template>
        </el-table-column>
        <el-table-column label="来源" width="100">
          <template #default="{ row }">
            <el-tag :type="row.source === 'admin' ? 'info' : 'warning'" size="small">
              {{ row.source === 'admin' ? '管理员创建' : '邮箱注册' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'pending'" type="warning" size="small">申请中</el-tag>
            <el-tag v-else-if="row.status === 'disabled'" type="danger" size="small">禁用</el-tag>
            <el-tag v-else-if="row._inactive" type="info" size="small">不活跃</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130">
          <template #default="{ row }">
            <div class="action-btns">
              <el-button v-if="row.status === 'pending'" class="btn-approve" size="small" @click="approveUser(row)">通过</el-button>
              <el-button v-if="row.status === 'pending'" class="btn-reject" size="small" @click="rejectUser(row)">拒绝</el-button>
              <el-button v-if="row.status === 'active' && row.id !== 1" class="btn-disable" size="small" @click="toggleStatus(row, 'disabled')">禁用</el-button>
              <el-button v-if="row.status === 'disabled'" class="btn-enable" size="small" @click="toggleStatus(row, 'active')">启用</el-button>
              <el-button v-if="isSuperAdmin && row.status === 'active' && row.id !== 1" class="btn-role" size="small" @click="openChangeRoleDialog(row)">修改角色</el-button>
              <el-button v-if="row.status === 'active' && row.id !== 1" class="btn-resetpwd" size="small" @click="openResetPwdDialog(row)">重置密码</el-button>
              <el-button v-if="row.id !== 1" class="btn-delete" size="small" @click="deleteUser(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="admin-pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          size="small"
          background
          @size-change="onPageSizeChange"
          @current-change="onPageChange"
        />
      </div>
    </div>

    <!-- 添加用户对话框 -->
    <el-dialog v-model="showAddDialog" :title="isSuperAdmin ? '添加用户' : '添加教师'" width="520px" destroy-on-close @closed="resetAddForm">
      <el-form ref="addFormRef" :model="addForm" :rules="addRules" label-width="100px" size="large">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="addForm.name" placeholder="如：张老师" />
        </el-form-item>
        <el-form-item label="用户名" prop="username">
          <el-input v-model="addForm.username" placeholder="用于登录" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="addForm.email" placeholder="接收登录通知" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="addForm.password" type="password" placeholder="输入或点击下方按钮生成" show-password />
          <el-button size="small" type="primary" plain style="margin-top:6px;font-size:12px" @click="generatePassword">随机生成密码</el-button>
        </el-form-item>
        <el-form-item v-if="isSuperAdmin" label="角色">
          <el-radio-group v-model="addForm.role">
            <el-radio value="teacher">教师</el-radio>
            <el-radio value="manager">管理员</el-radio>
          </el-radio-group>
          <div v-if="addForm.role === 'manager'" style="font-size:12px;color:#909399;margin-top:4px">
            👑 管理员可以创建和管理自己名下的教师账号，查看他们的课程数据
          </div>
        </el-form-item>
        <el-form-item v-if="isSuperAdmin && addForm.role === 'teacher'" label="所属管理员">
          <el-select v-model="addForm.managed_by" placeholder="不选则无归属" clearable style="width:100%">
            <el-option label="不设置（无归属）" value="" />
            <el-option v-for="m in managerOptions" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
          <div style="font-size:12px;color:#909399;margin-top:4px">
            选择后该教师将归属于所选管理员名下
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="adding" @click="handleAddTeacher">添加</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码对话框 -->
    <el-dialog v-model="showResetPwdDialog" title="重置密码" width="420px" destroy-on-close @closed="resetPwdDialog">
      <div class="reset-pwd-info">即将重置「{{ resetPwdTarget?.name }}」的密码，该操作不会影响任何课程或学生数据。</div>
      <el-form ref="resetPwdFormRef" :model="resetPwdForm" :rules="resetPwdRules" label-width="80px" size="large" style="margin-top:12px">
        <el-form-item label="新密码" prop="password">
          <el-input v-model="resetPwdForm.password" type="password" placeholder="输入或点击下方按钮生成" show-password />
          <el-button size="small" type="primary" plain style="margin-top:6px;font-size:12px" @click="generateResetPwd">随机生成密码</el-button>
        </el-form-item>
      </el-form>
      <div style="font-size:12px;color:#909399;text-align:center;margin-top:4px">重置后将发送邮件通知该用户</div>
      <template #footer>
        <el-button @click="showResetPwdDialog = false">取消</el-button>
        <el-button type="primary" :loading="resettingPwd" @click="handleResetPwd">确定重置</el-button>
      </template>
    </el-dialog>

    <!-- 修改角色对话框 -->
    <el-dialog v-model="showChangeRoleDialog" title="修改角色" width="400px" destroy-on-close @closed="changeRoleTarget = null">
      <div class="change-role-info">当前角色：<el-tag size="small">{{ changeRoleTarget?.role === 'manager' ? '管理员' : '教师' }}</el-tag></div>
      <el-form label-width="80px" size="large" style="margin-top:16px">
        <el-form-item label="新角色">
          <el-radio-group v-model="changeRoleForm.role">
            <el-radio value="teacher">教师</el-radio>
            <el-radio value="manager">管理员</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showChangeRoleDialog = false">取消</el-button>
        <el-button type="primary" :loading="changingRole" @click="handleChangeRole">确定修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminGetTeachers, adminAddTeacher, adminUpdateTeacher, adminDeleteTeacher } from '../api/index.js'

const router = useRouter()
const teacherInfo = JSON.parse(localStorage.getItem('teacher') || '{}')
const isSuperAdmin = teacherInfo.role === 'super_admin'

const teachers = ref([])
const loading = ref(false)
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const showAddDialog = ref(false)
const adding = ref(false)
const addFormRef = ref(null)
const managerOptions = ref([])

const addForm = ref({ name: '', username: '', email: '', password: '', role: 'teacher', managed_by: '' })
const addRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  email: [{ required: true, type: 'email', message: '请输入正确的邮箱', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function loadTeachers() {
  loading.value = true
  try {
    const res = await adminGetTeachers({ page: currentPage.value, page_size: pageSize.value })
    teachers.value = res.data.data || []
    total.value = res.data.total || 0
  } catch (err) {
    if (err.response?.status === 403) router.push('/app/calendar')
    ElMessage.error('加载失败')
  } finally { loading.value = false }
}

function onPageChange(page) { currentPage.value = page; loadTeachers() }
function onPageSizeChange() { currentPage.value = 1; loadTeachers() }

async function loadManagerOptions() {
  if (!isSuperAdmin) return
  try {
    const res = await adminGetTeachers({ role: 'manager' })
    managerOptions.value = res.data.data || []
  } catch {}
}

function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_'
  const length = 8 + Math.floor(Math.random() * 5) // 8~12 位
  // 保证至少包含一个大写字母、一个小写字母、一个数字、一个下划线
  let pwd = ''
  pwd += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]
  pwd += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]
  pwd += '0123456789'[Math.floor(Math.random() * 10)]
  pwd += '_'
  for (let i = 4; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)]
  }
  // 打乱顺序
  addForm.value.password = pwd.split('').sort(() => Math.random() - 0.5).join('')
}

function openAddDialog() {
  if (isSuperAdmin) {
    loadManagerOptions()
  }
  showAddDialog.value = true
}

async function handleAddTeacher() {
  const valid = await addFormRef.value?.validate().catch(() => false)
  if (!valid) return
  adding.value = true
  try {
    const data = {
      name: addForm.value.name,
      username: addForm.value.username,
      email: addForm.value.email,
      password: addForm.value.password,
      role: isSuperAdmin ? addForm.value.role : 'teacher'
    }
    if (isSuperAdmin && addForm.value.role === 'teacher' && addForm.value.managed_by) {
      data.managed_by = addForm.value.managed_by
    }
    await adminAddTeacher(data)
    const roleLabel = addForm.value.role === 'manager' ? '管理员' : '教师'
    ElMessage.success(`${roleLabel}已添加，通知邮件已发送`)
    await loadTeachers()
    showAddDialog.value = false
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

async function deleteUser(row) {
  try {
    await ElMessageBox.confirm(
      `确定要删除「${row.name}」吗？\n这将同时删除该教师的所有课程和学生数据，不可恢复！`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
    await adminDeleteTeacher(row.id)
    ElMessage.success('已删除')
    loadTeachers()
  } catch { /* cancel */ }
}

// ===== 重置密码 =====
const showResetPwdDialog = ref(false)
const resetPwdTarget = ref(null)
const resetPwdFormRef = ref(null)
const resettingPwd = ref(false)
const resetPwdForm = reactive({ password: '' })
const resetPwdRules = {
  password: [{ required: true, message: '请输入新密码', trigger: 'blur' }]
}

function generateResetPwd() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_'
  const length = 8 + Math.floor(Math.random() * 5)
  let pwd = ''
  pwd += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]
  pwd += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]
  pwd += '0123456789'[Math.floor(Math.random() * 10)]
  pwd += '_'
  for (let i = 4; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)]
  }
  resetPwdForm.password = pwd.split('').sort(() => Math.random() - 0.5).join('')
}

function openResetPwdDialog(row) {
  resetPwdTarget.value = row
  resetPwdForm.password = ''
  showResetPwdDialog.value = true
}

async function handleResetPwd() {
  const valid = await resetPwdFormRef.value?.validate().catch(() => false)
  if (!valid) return
  resettingPwd.value = true
  try {
    await adminUpdateTeacher(resetPwdTarget.value.id, { password: resetPwdForm.password })
    ElMessage.success('密码已重置，通知邮件已发送')
    showResetPwdDialog.value = false
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '重置失败')
  } finally { resettingPwd.value = false }
}

function resetPwdDialog() {
  resetPwdTarget.value = null
  resetPwdForm.password = ''
  resettingPwd.value = false
}

// ===== 修改角色 =====
const showChangeRoleDialog = ref(false)
const changeRoleTarget = ref(null)
const changeRoleForm = reactive({ role: 'teacher' })
const changingRole = ref(false)

function openChangeRoleDialog(row) {
  changeRoleTarget.value = row
  changeRoleForm.role = row.role || 'teacher'
  showChangeRoleDialog.value = true
}

async function handleChangeRole() {
  if (!changeRoleTarget.value || changeRoleForm.role === changeRoleTarget.value.role) {
    ElMessage.info('角色未发生变化')
    return
  }
  changingRole.value = true
  try {
    await adminUpdateTeacher(changeRoleTarget.value.id, { role: changeRoleForm.role })
    ElMessage.success('角色已修改')
    showChangeRoleDialog.value = false
    loadTeachers()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '修改失败')
  } finally { changingRole.value = false }
}

function resetAddForm() {
  addForm.value = { name: '', username: '', email: '', password: '', role: 'teacher', managed_by: '' }
}

onMounted(() => { loadTeachers() })
</script>

<style scoped>
@import "../assets/css/admin-users.css";
</style>
