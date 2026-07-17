<template>
  <div class="login-page">
    <div class="login-card">
      <div class="register-header" style="cursor:pointer" @click="$router.push('/')">
        <img src="../assets/images/logo.svg" class="title-icon" alt="课表侠" />
        <h1 class="login-title">课表侠</h1>
      </div>
      <p class="login-subtitle">输入注册邮箱，重置密码</p>
      <div v-if="!sent">
        <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="handleSubmit">
          <el-form-item prop="email">
            <el-input v-model="form.email" placeholder="注册时使用的邮箱" prefix-icon="Message" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" size="large" :loading="loading" style="width: 100%" @click="handleSubmit">
              {{ loading ? '发送中...' : '发送重置链接' }}
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div v-else>
        <div style="text-align:center;padding:12px 0;">
          <p style="color:#67c23a;font-size:15px;">✅ 邮件已发送</p>
          <p style="color:#909399;font-size:13px;margin-top:8px;">如果该邮箱已注册，重置链接已发送到您的邮箱，请查收。</p>
        </div>
      </div>
      <p class="register-login-link">
        <a href="javascript:void(0)" @click="$router.push('/login')">返回登录</a>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { forgotPassword } from '../api/index.js'

const router = useRouter()
const formRef = ref(null)
const loading = ref(false)
const sent = ref(false)

const form = reactive({ email: '' })
const rules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ]
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await forgotPassword(form.email)
    sent.value = true
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '发送失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@import "../assets/css/login.css";
</style>
