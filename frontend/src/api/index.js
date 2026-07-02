import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// 请求拦截器：自动带上 token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：token 过期时跳回登录页
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('teacher')
      window.location.href = '/login'
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

// ===== 学生 =====
export function getStudents(params) {
  return api.get('/students', { params })
}
export function createStudent(data) {
  return api.post('/students', data)
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

export default api
