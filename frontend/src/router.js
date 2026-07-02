import { createRouter, createWebHistory } from 'vue-router'
import CalendarView from './views/CalendarView.vue'
import DayDetailView from './views/DayDetailView.vue'
import LoginView from './views/LoginView.vue'
import StatisticsView from './views/StatisticsView.vue'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    // 已登录再访问 /login 则跳回首页
    beforeEnter: (to, from, next) => {
      if (localStorage.getItem('token')) {
        next('/')
      } else {
        next()
      }
    }
  },
  {
    path: '/',
    name: 'calendar',
    component: CalendarView,
    meta: { requiresAuth: true }
  },
  {
    path: '/day/:date',
    name: 'day-detail',
    component: DayDetailView,
    props: true,
    meta: { requiresAuth: true }
  },
  {
    path: '/statistics',
    name: 'statistics',
    component: StatisticsView,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 全局前置守卫：未登录跳转登录页
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !localStorage.getItem('token')) {
    next('/login')
  } else {
    next()
  }
})

export default router
