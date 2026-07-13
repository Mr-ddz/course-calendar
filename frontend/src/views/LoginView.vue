<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title"><img src="../assets/images/logo.svg" class="title-icon" alt="课表侠" /> 课表侠</h1>
      <p class="login-subtitle">请登录以继续</p>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        size="large"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="用户名"
            prefix-icon="User"
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
      </p>
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
  username: '',
  password: ''
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true

  try {
    const res = await login(form.username, form.password)
    const { token, teacher } = res.data.data

    localStorage.setItem('token', token)
    localStorage.setItem('teacher', JSON.stringify(teacher))

    ElMessage.success(`欢迎回来，${teacher.name}`)
    router.push('/calendar')
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

.title-icon { height: 1.8em; width: auto; display: block; }
.register-link { text-align: center; margin-top: 16px; font-size: 13px; color: #909399; }
.register-link a { color: #409eff; text-decoration: none; font-weight: 500; }
</style>
