import { createRouter, createWebHistory } from 'vue-router'
import LandingView from './views/LandingView.vue'
import CalendarView from './views/CalendarView.vue'
import DayDetailView from './views/DayDetailView.vue'
import LoginView from './views/LoginView.vue'
import StatisticsView from './views/StatisticsView.vue'
import RegisterView from './views/RegisterView.vue'
import AdminUsersView from './views/AdminUsersView.vue'

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
      if (localStorage.getItem('token')) next('/calendar')
      else next()
    }
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
    beforeEnter: (to, from, next) => {
      if (localStorage.getItem('token')) next('/calendar')
      else next()
    }
  },
  {
    path: '/calendar',
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
  },
  {
    path: '/admin/users',
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
