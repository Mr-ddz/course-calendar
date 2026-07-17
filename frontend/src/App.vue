<template>
  <!-- 不需要侧边栏的页面 -->
  <router-view v-if="!showSidebar" />

  <!-- 需要侧边栏的页面 -->
  <el-container v-else style="height: 100vh">
    <Sidebar
      :collapsed="collapsed"
      :nav-items="navItems"
      :teacher-id="teacherInfo.id"
      @toggle="collapsed = !collapsed"
    />

    <el-container direction="vertical">
      <el-header class="top-bar">
        <span class="top-bar-title">{{ pageTitle }}</span>
        <div class="top-bar-right">
          <span class="top-bar-user">{{ teacherName }}</span>
          <span class="top-bar-role">{{ isAdmin ? '管理员' : '教师' }}</span>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from './components/Sidebar.vue'

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
  return items
})

const pageTitle = computed(() => {
  const names = { 'calendar': '月历', 'statistics': '统计', 'day-detail': '课程详情', 'admin-users': '用户管理' }
  return names[route.name] || '课表侠'
})

</script>

<style>
@import './assets/css/global.css';

.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; height: 56px;
  background: #fff; border-bottom: 1px solid #eee;
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
  background: #f5f7fa; padding: 0;
}
</style>
