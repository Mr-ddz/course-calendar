<template>
  <div class="sidebar-wrapper" :style="{ width: collapsed ? '60px' : '200px' }">
    <div class="sidebar-logo-area">
      <img src="../assets/images/logo.svg" class="sidebar-logo" alt="课表侠" />
      <span class="sidebar-title" v-show="!collapsed">课表侠</span>
    </div>

    <el-menu
      :default-active="activeMenu"
      :collapse="collapsed"
      background-color="#1a1a2e"
      text-color="rgba(255,255,255,0.7)"
      active-text-color="#fff"
      class="sidebar-menu"
      @select="handleSelect"
    >
      <el-menu-item v-for="item in navItems" :key="item.path" :index="item.path">
        <span class="menu-icon">{{ item.icon }}</span>
        <template #title>{{ item.label }}</template>
      </el-menu-item>
      <el-menu-item index="logout">
        <span class="menu-icon">🚪</span>
        <template #title>退出</template>
      </el-menu-item>
    </el-menu>

    <div class="sidebar-bottom">
      <el-button size="small" class="collapse-btn" @click="$emit('toggle')">
        {{ collapsed ? '▶' : '◀' }}
      </el-button>
      <div class="sidebar-beian" v-show="!collapsed">
        <a href="https://beian.miit.gov.cn/" target="_blank">辽ICP备2026015173号-1</a>
      </div>
      <div class="sidebar-version" v-show="!collapsed">
        <span>v{{ version }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { logout as logoutApi } from '../api/index.js'
import versionData from '../assets/version.json'

const version = ref('1.0.0')

onMounted(() => {
  version.value = versionData.version || '1.0.0'
})

const props = defineProps({
  collapsed: Boolean,
  navItems: Array,
  teacherId: Number
})

defineEmits(['toggle'])

const router = useRouter()
const route = useRoute()
const activeMenu = computed(() => {
  if (route.name === 'day-detail') return '/app/calendar'
  return route.path
})

function handleSelect(index) {
  if (index === 'logout') {
    handleLogout()
  } else {
    router.push(index)
  }
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确认退出登录？', '退出', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'info'
    })
    try { await logoutApi() } catch { }
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('teacher')
    router.push('/login')
  } catch { }
}
</script>

<style>
@import "../assets/css/sidebar.css";
</style>
