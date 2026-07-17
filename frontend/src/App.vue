<template>
  <!-- 不需要侧边栏的页面（登录/注册/忘记密码/门户等） -->
  <router-view v-if="!showSidebar" />

  <!-- 需要侧边栏的页面 -->
  <div v-else class="layout-wrapper">
    <div class="sidebar" :class="{ 'sidebar--collapsed': collapsed }">
      <div class="sidebar-header">
        <img src="./assets/images/logo.svg" class="sidebar-logo" alt="课表侠" />
        <span class="sidebar-title" v-show="!collapsed">课表侠</span>
      </div>
      <div class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.label"
          :to="item.isLogout ? undefined : item.path"
          class="nav-item"
          :class="{ 'nav-item--active': !item.isLogout && isActive(item.path) }"
          @click="item.isLogout && handleLogout()"
          :style="item.isLogout ? { cursor: 'pointer' } : {}"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label" v-show="!collapsed">{{ item.label }}</span>
        </router-link>
      </div>
      <div class="sidebar-footer">
        <div class="sidebar-actions">
          <el-button size="small" class="collapse-btn" @click="collapsed = !collapsed">
            {{ collapsed ? '▶' : '◀' }}
          </el-button>
        </div>
        <div class="sidebar-beian" v-show="!collapsed">
          <a href="https://beian.miit.gov.cn/" target="_blank">辽ICP备2026015173号-1</a>
        </div>
      </div>
    </div>
    <div class="main-area">
      <div class="top-bar">
        <span class="top-bar-title">{{ pageTitle }}</span>
        <div class="top-bar-right">
          <span class="top-bar-user">{{ teacherName }}</span>
          <span class="top-bar-role">{{ isAdmin ? '管理员' : '教师' }}</span>
        </div>
      </div>
      <div class="main-content">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { logout as logoutApi } from './api/index.js'

const router = useRouter()
const route = useRoute()
const collapsed = ref(false)

const teacherInfo = JSON.parse(localStorage.getItem('teacher') || '{}')
const teacherName = teacherInfo.name || ''
const isAdmin = teacherInfo.id === 1

const sidebarRoutes = ['/app/calendar', '/app/day', '/app/statistics', '/app/users']
const showSidebar = computed(() => sidebarRoutes.some(p => route.path.startsWith(p)))

const navItems = computed(() => {
  const items = [
    { path: '/app/calendar', icon: '📅', label: '月历' },
    { path: '/app/statistics', icon: '📊', label: '统计' }
  ]
  if (isAdmin) {
    items.push({ path: '/app/users', icon: '👤', label: '用户管理' })
  }
  items.push({ path: '', icon: '🚪', label: '退出', isLogout: true })
  return items
})

const pageTitle = computed(() => {
  const names = { 'calendar': '月历', 'statistics': '统计', 'day-detail': '课程详情', 'admin-users': '用户管理' }
  return names[route.name] || '课表侠'
})

function isActive(path) {
  if (route.name === 'day-detail' && path.includes('/calendar')) return true
  return route.path.startsWith(path)
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
@import './assets/css/global.css';

.layout-wrapper {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.sidebar {
  width: 200px;
  min-width: 200px;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  transition: width 0.25s, min-width 0.25s;
  z-index: 100;
}
.sidebar--collapsed {
  width: 60px;
  min-width: 60px;
}
.sidebar-header {
  display: flex; align-items: center; gap: 10px;
  padding: 20px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.sidebar-logo { width: 28px; height: auto; flex-shrink: 0; }
.sidebar-title { font-size: 18px; font-weight: 700; white-space: nowrap; }
.sidebar-nav {
  flex: 1; padding: 12px 8px;
  display: flex; flex-direction: column; gap: 2px; overflow-y: auto;
}
.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: 8px;
  color: rgba(255,255,255,0.7); text-decoration: none;
  font-size: 14px; font-weight: 500; transition: all 0.15s; white-space: nowrap;
}
.nav-item:hover { background: rgba(255,255,255,0.1); color: #fff; }
.nav-item--active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff; font-weight: 600;
}
.nav-icon { font-size: 18px; width: 24px; text-align: center; flex-shrink: 0; }
.nav-spacer { flex: 1; }
.logout-btn {
  background: rgba(245,108,108,0.1); border: none; color: #f56c6c;
  font-size: 12px; margin: 0 4px;
}
.logout-btn:hover { background: rgba(245,108,108,0.25); }
.sidebar-footer {
  padding: 12px 8px; border-top: 1px solid rgba(255,255,255,0.08);
  display: flex; flex-direction: column; gap: 6px;
}
.sidebar-actions { display: flex; gap: 6px; width: 100%; }
.sidebar-actions .collapse-btn,
.sidebar-actions .logout-btn { flex: 1; }
.sidebar-user { padding: 0 6px; }
.sidebar-beian { text-align: center; font-size: 10px; }
.sidebar-beian a { color: rgba(255,255,255,0.35); text-decoration: none; }
.user-name {
  font-size: 12px; color: rgba(255,255,255,0.6);
  display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.collapse-btn {
  width: 100%; background: rgba(255,255,255,0.08);
  border: none; color: rgba(255,255,255,0.6); font-size: 12px;
}
.collapse-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
.logout-btn {
  width: 100%; background: rgba(245,108,108,0.15);
  border: none; color: #f56c6c; font-size: 12px;
}
.logout-btn:hover { background: rgba(245,108,108,0.3); }
.main-area {
  flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #f5f7fa;
}
.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 24px; background: #fff; border-bottom: 1px solid #eee;
  flex-shrink: 0;
}
.top-bar-title { font-size: 16px; font-weight: 600; color: #303133; }
.top-bar-right { display: flex; align-items: center; gap: 10px; }
.top-bar-user { font-size: 14px; font-weight: 500; color: #409eff; }
.top-bar-role {
  font-size: 11px; color: #fff; background: #409eff;
  padding: 2px 8px; border-radius: 10px; font-weight: 500;
}
.main-content {
  flex: 1; overflow-y: auto; overflow-x: hidden;
}
</style>