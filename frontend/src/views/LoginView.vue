<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title" style="cursor:pointer" @click="$router.push('/')"><img src="../assets/images/logo.svg" class="title-icon" alt="课表侠" /> 课表侠</h1>
      <p class="login-subtitle">请登录以继续</p>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        size="large"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="identity">
          <el-input
            v-model="form.identity"
            placeholder="邮箱地址"
            prefix-icon="Message"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            prefix-icon="Lock"
            show-password
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            style="width: 100%"
            @click="handleLogin"
          >
            {{ loading ? '登录中...' : '登 录' }}
          </el-button>
        </el-form-item>
      </el-form>
      <p class="register-link">
        没有账号？<a href="javascript:void(0)" @click="$router.push('/register')">免费注册</a>
        &nbsp;|&nbsp;
        <a href="javascript:void(0)" @click="$router.push('/forgot-password')">忘记密码</a>
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
import { login } from '../api/index.js'

const router = useRouter()
const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  identity: '',
  password: ''
})

const rules = {
  identity: [{ required: true, message: '请输入邮箱', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true

  try {
    const res = await login(form.identity, form.password)
    const { token, refresh_token, teacher } = res.data.data

    localStorage.setItem('token', token)
    localStorage.setItem('refresh_token', refresh_token || '')
    localStorage.setItem('teacher', JSON.stringify(teacher))

    ElMessage.success(`欢迎回来，${teacher.name}`)
    router.push('/app/calendar')
  } catch (err) {
    const msg = err.response?.data?.error || '登录失败'
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@import "../assets/css/login.css";
</style>
