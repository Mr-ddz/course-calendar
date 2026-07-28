import { createRouter, createWebHistory } from 'vue-router'
import axios from 'axios'
import LandingView from './views/LandingView.vue'
import CalendarView from './views/CalendarView.vue'
import DayDetailView from './views/DayDetailView.vue'
import LoginView from './views/LoginView.vue'
import StatisticsView from './views/StatisticsView.vue'
import RegisterView from './views/RegisterView.vue'
import AdminUsersView from './views/AdminUsersView.vue'
import ForgotPasswordView from './views/ForgotPasswordView.vue'
import ResetPasswordView from './views/ResetPasswordView.vue'
import StudentsView from './views/StudentsView.vue'

let _tokenValidated = false

const routes = [
  {
    path: '/',
    name: 'landing',
    component: LandingView
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    beforeEnter: (to, from, next) => {
      if (localStorage.getItem('token')) next('/app/calendar')
      else next()
    }
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
    beforeEnter: (to, from, next) => {
      if (localStorage.getItem('token')) next('/app/calendar')
      else next()
    }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: ForgotPasswordView,
    beforeEnter: (to, from, next) => {
      if (localStorage.getItem('token')) next('/app/calendar')
      else next()
    }
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: ResetPasswordView,
    beforeEnter: (to, from, next) => {
      if (localStorage.getItem('token')) next('/app/calendar')
      else next()
    }
  },
  {
    path: '/app/calendar',
    name: 'calendar',
    component: CalendarView,
    meta: { requiresAuth: true }
  },
  {
    path: '/app/day/:date',
    name: 'day-detail',
    component: DayDetailView,
    props: true,
    meta: { requiresAuth: true }
  },
  {
    path: '/app/statistics',
    name: 'statistics',
    component: StatisticsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/app/students',
    name: 'students',
    component: StudentsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/app/users',
    name: 'admin-users',
    component: AdminUsersView,
    meta: { requiresAuth: true }
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth) {
    if (!token) {
      next('/login')
      return
    }
    // 只在每次页面加载时验证一次 token 有效性
    if (!_tokenValidated) {
      try {
        await axios.get('/api/me', { headers: { Authorization: `Bearer ${token}` } })
        _tokenValidated = true
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('teacher')
        next('/login')
        return
      }
    }
    next()
  } else {
    if (token) _tokenValidated = false // 退出登录后重置
    next()
  }
})

export default router
