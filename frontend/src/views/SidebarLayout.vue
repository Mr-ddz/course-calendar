<template>
  <div class="layout-wrapper">
    <!-- 左侧导航 -->
    <div class="sidebar" :class="{ 'sidebar--collapsed': collapsed }">
      <div class="sidebar-header">
        <img src="../assets/images/logo.svg" class="sidebar-logo" alt="课表侠" />
        <span class="sidebar-title" v-show="!collapsed">课表侠</span>
      </div>

      <div class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ 'nav-item--active': isActive(item.path) }"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label" v-show="!collapsed">{{ item.label }}</span>
        </router-link>
      </div>

      <div class="sidebar-footer">
        <div class="sidebar-user" v-show="!collapsed">
          <span class="user-name">{{ teacherName }}</span>
        </div>
        <div class="sidebar-actions">
          <el-button size="small" class="collapse-btn" @click="collapsed = !collapsed">
            {{ collapsed ? '▶' : '◀' }}
          </el-button>
          <el-button size="small" class="logout-btn" @click="handleLogout">退出</el-button>
        </div>
        <div class="sidebar-beian" v-show="!collapsed">
          <a href="https://beian.miit.gov.cn/" target="_blank">辽ICP备2026015173号-1</a>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-area" :class="{ 'main-area--expanded': collapsed }">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { logout as logoutApi } from '../api/index.js'

const router = useRouter()
const route = useRoute()
const collapsed = ref(false)

const teacherInfo = JSON.parse(localStorage.getItem('teacher') || '{}')
const teacherName = teacherInfo.name || ''
const isAdmin = teacherInfo.id === 1

const navItems = computed(() => {
  const items = [
    { path: '/app/calendar', icon: '📅', label: '月历' },
    { path: '/app/statistics', icon: '📊', label: '统计' }
  ]
  if (isAdmin) {
    items.push({ path: '/app/users', icon: '👤', label: '用户管理' })
  }
  return items
})

function isActive(path) {
  // 详情页时高亮月历
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
    try { await logoutApi() } catch { /* ignore */ }
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('teacher')
    router.push('/login')
  } catch { /* cancel */ }
}
</script>

<style scoped>
.layout-wrapper {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* 侧边栏 */
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
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.sidebar-logo {
  width: 28px;
  height: auto;
  flex-shrink: 0;
}
.sidebar-title {
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
}

/* 导航 */
.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s;
  white-space: nowrap;
}
.nav-item:hover {
  background: rgba(255,255,255,0.1);
  color: #fff;
}
.nav-item--active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-weight: 600;
}
.nav-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

/* 底部 */
.sidebar-footer {
  padding: 12px 8px;
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sidebar-actions {
  display: flex;
  gap: 6px;
  width: 100%;
}
.sidebar-actions .collapse-btn,
.sidebar-actions .logout-btn {
  flex: 1;
}
.sidebar-user { padding: 0 6px; }
.sidebar-beian { text-align: center; font-size: 10px; }
.sidebar-beian a { color: rgba(255,255,255,0.35); text-decoration: none; }
.sidebar-user {
  padding: 0 6px;
  width: 100%;
}
.user-name {
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.collapse-btn {
  width: 100%;
  background: rgba(255,255,255,0.08);
  border: none;
  color: rgba(255,255,255,0.6);
  font-size: 12px;
}
.collapse-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
.logout-btn {
  width: 100%;
  background: rgba(245,108,108,0.15);
  border: none;
  color: #f56c6c;
  font-size: 12px;
}
.logout-btn:hover { background: rgba(245,108,108,0.3); }

/* 主区域 */
.main-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  background: #f5f7fa;
}
</style>
