<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">📚 教师课程表</h1>
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
      <p v-if="error" class="login-error">{{ error }}</p>
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
const error = ref('')

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
  error.value = ''

  try {
    const res = await login(form.username, form.password)
    const { token, teacher } = res.data.data

    localStorage.setItem('token', token)
    localStorage.setItem('teacher', JSON.stringify(teacher))

    ElMessage.success(`欢迎回来，${teacher.name}`)
    router.push('/')
  } catch (err) {
    const msg = err.response?.data?.error || '登录失败'
    error.value = msg
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.login-card {
  width: 400px;
  padding: 40px 36px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.15);
}
.login-title {
  font-size: 24px;
  font-weight: 700;
  text-align: center;
  color: #303133;
  margin-bottom: 4px;
}
.login-subtitle {
  text-align: center;
  color: #909399;
  font-size: 14px;
  margin-bottom: 28px;
}
.login-error {
  color: #f56c6c;
  text-align: center;
  font-size: 13px;
  margin-top: 12px;
}
@media (max-width: 480px) {
  .login-card {
    width: 92%;
    padding: 28px 20px;
  }
}
</style>
