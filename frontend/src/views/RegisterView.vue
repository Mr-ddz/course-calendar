<template>
  <div class="login-page">
    <div class="login-card">
      <div class="register-header">
        <img src="../assets/images/logo.svg" class="title-icon" alt="课表侠" />
        <h1 class="login-title">课表侠</h1>
      </div>
      <p class="login-subtitle">免费注册，即刻开始</p>
      <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="handleRegister">
        <!-- 蜜罐字段：对用户不可见，机器人会填 -->
        <el-form-item style="position:absolute;left:-9999px">
          <el-input v-model="form.website" name="website" autocomplete="off" tabindex="-1" />
        </el-form-item>
        <el-form-item prop="email">
          <el-input v-model="form.email" placeholder="邮箱地址" prefix-icon="Message" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码（至少6位）" prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" :loading="loading" style="width: 100%" @click="handleRegister">
            {{ loading ? '注册中...' : '免费注册' }}
          </el-button>
        </el-form-item>
      </el-form>
      <p class="register-login-link">
        已有账号？<a href="javascript:void(0)" @click="$router.push('/login')">去登录</a>
      </p>
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

const form = reactive({ email: '', password: '', website: '' })

// 记录页面加载时间，用于防机器人
const pageLoadedAt = ref(Date.now())
const rules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ]
}

async function handleRegister() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const res = await register(form.email, form.password, {
      _ts: pageLoadedAt.value,
      website: form.website
    })
    const { token, teacher } = res.data.data
    localStorage.setItem('token', token)
    localStorage.setItem('teacher', JSON.stringify(teacher))
    ElMessage.success(`欢迎，${teacher.name}`)
    router.push('/calendar')
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
