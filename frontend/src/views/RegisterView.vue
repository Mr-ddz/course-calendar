<template>
  <div class="login-page">
    <div class="login-card">
      <div class="register-header">
        <img src="../assets/images/logo.svg" class="title-icon" alt="课表侠" />
        <h1 class="login-title">课表侠</h1>
      </div>
      <p class="login-subtitle">免费注册，管理员审核后即可使用</p>
      <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="handleRegister">
        <el-form-item prop="name">
          <el-input v-model="form.name" placeholder="用户名（用于登录显示）" prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="email">
          <el-input v-model="form.email" placeholder="邮箱地址" prefix-icon="Message" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码（至少6位）" prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item prop="confirm_password">
          <el-input v-model="form.confirm_password" type="password" placeholder="确认密码" prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" :loading="loading" style="width: 100%" @click="handleRegister">
            {{ loading ? '提交中...' : '免费注册' }}
          </el-button>
        </el-form-item>
      </el-form>
      <p class="register-login-link">
        已有账号？<a href="javascript:void(0)" @click="$router.push('/login')">去登录</a>
      </p>
    </div>
    <div style="position: fixed; bottom: 12px; left: 0; right: 0; text-align: center; font-size: 11px; color: rgba(255,255,255,0.5);">
      <a href="https://beian.miit.gov.cn/" target="_blank" style="color: rgba(255,255,255,0.5); text-decoration: none;">辽ICP备2026015173号-1</a>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { register } from '../api/index.js'

const router = useRouter()
const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirm_password: '',
  website: ''
})

const validateConfirm = (_rule, value, callback) => {
  if (value !== form.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules = {
  name: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, message: '用户名至少2个字符', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ],
  confirm_password: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' }
  ]
}

async function handleRegister() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await register({ ...form, _ts: Date.now() })
    ElMessage.success('注册成功，请等待管理员审核')
    router.push('/login')
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '注册失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@import "../assets/css/login.css";
.register-header { text-align: center; margin-bottom: 16px; }
.register-header .title-icon { height: 60px; width: auto; display: block; margin: 0 auto 6px; }
.register-header .login-title { display: block !important; margin-bottom: 0; }
.register-login-link { text-align: center; margin-top: 16px; font-size: 13px; color: #909399; }
.register-login-link a { color: #409eff; text-decoration: none; font-weight: 500; }
</style>
