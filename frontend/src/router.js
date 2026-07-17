import { createRouter, createWebHistory } from 'vue-router'
import LandingView from './views/LandingView.vue'
import CalendarView from './views/CalendarView.vue'
import DayDetailView from './views/DayDetailView.vue'
import LoginView from './views/LoginView.vue'
import StatisticsView from './views/StatisticsView.vue'
import RegisterView from './views/RegisterView.vue'
import AdminUsersView from './views/AdminUsersView.vue'
import ForgotPasswordView from './views/ForgotPasswordView.vue'
import ResetPasswordView from './views/ResetPasswordView.vue'

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
    path: '/app/users',
    name: 'admin-users',
    component: AdminUsersView,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !localStorage.getItem('token')) {
    next('/login')
  } else {
    next()
  }
})

export default router
