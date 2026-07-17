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
        <template #title>
          <span class="menu-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </template>
      </el-menu-item>
      <el-menu-item index="logout">
        <template #title>
          <span class="menu-icon">🚪</span>
          <span>退出</span>
        </template>
      </el-menu-item>
    </el-menu>

    <div class="sidebar-bottom">
      <el-button size="small" class="collapse-btn" @click="$emit('toggle')">
        {{ collapsed ? '▶' : '◀' }}
      </el-button>
      <div class="sidebar-beian" v-show="!collapsed">
        <a href="https://beian.miit.gov.cn/" target="_blank">辽ICP备2026015173号-1</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { logout as logoutApi } from '../api/index.js'

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

<style scoped>
.sidebar-wrapper {
  height: 100vh;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  flex-direction: column;
  transition: width 0.25s;
  overflow: hidden;
  flex-shrink: 0;
}
.sidebar-logo-area {
  display: flex; align-items: center; gap: 10px;
  padding: 20px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  min-height: 68px;
}
.sidebar-logo { width: 28px; height: auto; flex-shrink: 0; }
.sidebar-title { font-size: 18px; font-weight: 700; white-space: nowrap; color: #fff; }

.sidebar-menu {
  flex: 1;
  border-right: none !important;
  padding: 8px 0;
}
.sidebar-menu .el-menu-item {
  display: flex;
  align-items: center;
  margin: 2px 8px;
  border-radius: 8px;
  height: 42px;
  line-height: 42px;
}
.sidebar-menu .el-menu-item.is-active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  color: #fff !important;
}
.sidebar-menu .el-menu-item:hover {
  background: rgba(255,255,255,0.1) !important;
}
.menu-icon { font-size: 16px; margin-right: 8px; }

.sidebar-bottom {
  padding: 12px 8px;
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}
.collapse-btn {
  width: 100%;
  background: rgba(255,255,255,0.08);
  border: none;
  color: rgba(255,255,255,0.6);
  font-size: 12px;
}
.collapse-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
.sidebar-beian { font-size: 10px; }
.sidebar-beian a { color: rgba(255,255,255,0.35); text-decoration: none; }
</style>
