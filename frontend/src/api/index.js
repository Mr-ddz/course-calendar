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

// 响应拦截器：token 过期时跳回登录页（排除登录接口）
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      // 登录接口的 401 不需要重定向，让页面自己处理错误提示
      if (error.config.url === '/login') {
        return Promise.reject(error)
      }
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

export default api
