<template>
  <!-- 不需要侧边栏的页面 -->
  <router-view v-if="!showSidebar" />

  <!-- 需要侧边栏的页面 -->
  <el-container v-else style="height: 100vh">
    <Sidebar
      :collapsed="collapsed"
      :nav-items="navItems"
      @toggle="collapsed = !collapsed"
    />

    <el-container direction="vertical">
      <el-header class="top-bar">
        <span class="top-bar-title">{{ pageTitle }}</span>
        <div class="top-bar-right">
          <span class="top-bar-user">{{ teacherName }}</span>
          <span class="top-bar-role">{{ teacherRole === 'super_admin' ? '超级管理员' : teacherRole === 'manager' ? '管理员' : '教师' }}</span>
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

const teacherName = computed(() => route.path && (JSON.parse(localStorage.getItem('teacher') || '{}').name || ''))
const teacherRole = computed(() => route.path && (JSON.parse(localStorage.getItem('teacher') || '{}').role || 'teacher'))
const canManageUsers = computed(() => {
  void route.path
  const role = teacherRole.value
  return role === 'super_admin' || role === 'manager'
})

const sidebarRoutes = ['/app/calendar', '/app/day', '/app/statistics', '/app/students', '/app/users']
const showSidebar = computed(() => sidebarRoutes.some(p => route.path.startsWith(p)))

const navItems = computed(() => {
  const items = [
    { path: '/app/calendar', icon: 'Calendar', label: '月历' },
    { path: '/app/students', icon: 'User', label: '学生' },
    { path: '/app/statistics', icon: 'DataAnalysis', label: '统计' }
  ]
  if (canManageUsers.value) {
    items.push({ path: '/app/users', icon: 'UserFilled', label: '用户管理' })
  }
  return items
})

const pageTitle = computed(() => {
  const names = { 'calendar': '月历', 'statistics': '统计', 'day-detail': '课程详情', 'students': '学生管理', 'admin-users': '用户管理' }
  return names[route.name] || '课表侠'
})

</script>

<style>
@import './assets/css/global.css';
@import './assets/css/app-layout.css';
</style>
