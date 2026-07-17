<template>
  <div class="login-page">
    <div class="login-card">
      <div class="register-header" style="cursor:pointer" @click="$router.push('/')">
        <img src="../assets/images/logo.svg" class="title-icon" alt="课表侠" />
        <h1 class="login-title">课表侠</h1>
      </div>
      <p class="login-subtitle">设置新密码</p>
      <div v-if="!done">
        <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="handleSubmit">
          <el-form-item prop="password">
            <el-input v-model="form.password" type="password" placeholder="新密码（至少6位）" prefix-icon="Lock" show-password />
          </el-form-item>
          <el-form-item prop="confirm_password">
            <el-input v-model="form.confirm_password" type="password" placeholder="确认新密码" prefix-icon="Lock" show-password />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" size="large" :loading="loading" style="width: 100%" @click="handleSubmit">
              {{ loading ? '重置中...' : '重置密码' }}
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div v-else>
        <div style="text-align:center;padding:12px 0;">
          <p style="color:#67c23a;font-size:15px;">✅ 密码已重置</p>
          <p style="color:#909399;font-size:13px;margin-top:8px;">请使用新密码登录</p>
          <el-button type="primary" style="margin-top:12px;" @click="$router.push('/login')">去登录</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { resetPassword } from '../api/index.js'

const router = useRouter()
const route = useRoute()
const formRef = ref(null)
const loading = ref(false)
const done = ref(false)

const form = reactive({ password: '', confirm_password: '' })
const token = ref('')

const validateConfirm = (_rule, value, callback) => {
  if (value !== form.password) callback(new Error('两次输入的密码不一致'))
  else callback()
}

const rules = {
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ],
  confirm_password: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' }
  ]
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await resetPassword(token.value, form.password)
    done.value = true
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '重置失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  token.value = route.query.token || ''
  if (!token.value) {
    ElMessage.error('重置链接无效')
    router.push('/login')
  }
})
</script>

<style scoped>
@import "../assets/css/login.css";
</style>
