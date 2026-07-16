import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// 是否正在刷新 token
let isRefreshing = false
// 等待刷新 token 的请求队列
let refreshSubscribers = []

function onRefreshed(newToken) {
  refreshSubscribers.forEach(cb => cb(newToken))
  refreshSubscribers = []
}

function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb)
}

// 请求拦截器：自动带上 token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：自动刷新 token
api.interceptors.response.use(
  response => response,
  async error => {
    const { config, response } = error
    // 无响应或非 401 直接抛出
    if (!response || response.status !== 401) {
      return Promise.reject(error)
    }

    // 登录接口的 401 不处理
    if (config.url === '/login') {
      return Promise.reject(error)
    }

    // refresh 接口本身的 401 直接跳登录
    if (config.url === '/refresh') {
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('teacher')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // 检查是否是 token 过期
    const errData = response.data
    if (errData && errData.error === 'token_expired') {
      // 如果已经在刷新，排队等待
      if (isRefreshing) {
        return new Promise(resolve => {
          addRefreshSubscriber(newToken => {
            config.headers.Authorization = `Bearer ${newToken}`
            resolve(api(config))
          })
        })
      }

      isRefreshing = true
      const refreshToken = localStorage.getItem('refresh_token')

      if (!refreshToken) {
        localStorage.removeItem('token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('teacher')
        window.location.href = '/login'
        isRefreshing = false
        return Promise.reject(error)
      }

      try {
        const res = await axios.post('/api/refresh', { refresh_token: refreshToken })
        const { token: newToken, teacher } = res.data.data

        localStorage.setItem('token', newToken)
        if (teacher) {
          localStorage.setItem('teacher', JSON.stringify(teacher))
        }

        // 重试原始请求
        config.headers.Authorization = `Bearer ${newToken}`
        onRefreshed(newToken)
        isRefreshing = false
        return api(config)
      } catch {
        // refresh 失败，跳登录
        localStorage.removeItem('token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('teacher')
        window.location.href = '/login'
        isRefreshing = false
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

// ===== 认证 =====
export function login(username, password) {
  return api.post('/login', { username, password })
}
export function logout() {
  return api.post('/logout')
}
export function getMe() {
  return api.get('/me')
}
export function getTeachers() {
  return api.get('/teachers')
}

export function forgotPassword(email) {
  return api.post('/forgot-password', { email })
}
export function resetPassword(token, password) {
  return api.post('/reset-password', { token, password })
}
export function register(data) {
  return api.post('/register', data)
}
export function adminGetTeachers() {
  return api.get('/admin/teachers')
}
export function adminAddTeacher(data) {
  return api.post('/admin/teachers', data)
}
export function adminUpdateTeacher(id, data) {
  return api.put(`/admin/teachers/${id}`, data)
}
export function adminDeleteTeacher(id) {
  return api.delete(`/admin/teachers/${id}`)
}

// ===== 学生 =====
export function getStudents(params) {
  return api.get('/students', { params })
}
export function createStudent(data) {
  return api.post('/students', data)
}
export function getStudentRecentFee(id) {
  return api.get('/students/recent-fee', { params: { id } })
}

// ===== 课程 =====
export function getCourses(date) {
  return api.get('/courses', { params: { date } })
}
export function getCoursesRange(startDate, endDate) {
  return api.get('/courses/range', { params: { start_date: startDate, end_date: endDate } })
}
export function createCourse(data) {
  return api.post('/courses', data)
}
export function updateCourse(id, data) {
  return api.put(`/courses/${id}`, data)
}
export function deleteCourse(id, params = {}) {
  return api.delete(`/courses/${id}`, { params })
}
export function searchCourses(params) {
  return api.get('/courses/search', { params })
}
export function getStatistics(params) {
  return api.get('/courses/statistics', { params })
}
export function exportCsv() {
  return api.get('/courses/export-csv')
}

export default api
