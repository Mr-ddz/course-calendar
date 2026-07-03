<template>
  <div class="calendar-page">
    <header class="cal-header">
      <div class="cal-header-top">
        <h1 class="cal-title"><img src="../assets/images/logo.svg" class="title-icon" /> {{ teacherName }}的课程表</h1>
        <div class="cal-user">
          <span class="cal-user-name">{{ teacherName }}</span>
          <el-button size="small" @click="handleLogout">退出</el-button>
        </div>
      </div>
      <div class="cal-tabs">
        <el-button
          :type="$route.name === 'calendar' ? 'primary' : 'default'"
          size="small"
          @click="$router.push('/')"
        >📅 月历</el-button>
        <el-button
          :type="$route.name === 'statistics' ? 'primary' : 'default'"
          size="small"
          @click="$router.push('/statistics')"
        >📊 统计</el-button>
      </div>
      <div class="cal-nav">
        <el-button @click="changeMonth(-1)">&lt; 上月</el-button>
        <span class="cal-month-title">{{ monthLabel }}</span>
        <el-button @click="changeMonth(1)">下月 &gt;</el-button>
        <el-button size="small" style="margin-left:12px" @click="backToToday">今天</el-button>
      </div>
      <div class="cal-grid">
        <div class="cal-weekdays">
          <span v-for="d in weekDays" :key="d">{{ d }}</span>
        </div>
        <div class="cal-days">
          <div
            v-for="(day, idx) in calendarDays"
            :key="idx"
            class="cal-day"
            :class="{
              'cal-day--empty': !day,
              'cal-day--today': day && day.dateStr === todayStr,
              'cal-day--active': day && day.dateStr === activeDate,
              'cal-day--other': day && !day.isCurrentMonth
            }"
            @click="day && goToDay(day.dateStr)"
          >
            <template v-if="day">
              <div class="cal-day-number">{{ day.dayNum }}</div>
              <div class="cal-day-students" v-if="day.students.length">
                <span
                  v-for="(s, si) in day.students.slice(0, 4)"
                  :key="si"
                  class="cal-student-tag"
                  :style="{ background: s.color + '30', color: s.color }"
                ><span class="tag-name">{{ s.name }}</span><span v-if="s.teacherName" class="tag-teacher">{{ s.teacherName }}</span> <span class="tag-time">{{ s.time }}</span><span v-if="s.repeatType === 'weekly'" class="tag-repeat">🔄</span></span>
                <span v-if="day.students.length > 4" class="cal-student-more">+{{ day.students.length - 4 }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </header>

    <!-- 课程 timetable -->
    <div class="timetable-wrapper">
      <h2 class="timetable-title">📅 {{ monthLabel }}课程安排</h2>
      <div class="timetable-scroll">
        <table class="timetable">
          <thead>
            <tr>
              <th class="time-col"></th>
              <th v-for="d in weekDayHeaders" :key="d" class="day-col">{{ d }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="hour in timeSlots" :key="hour">
              <td class="time-cell">{{ String(hour).padStart(2, '0') }}:00~{{ String(hour+1).padStart(2, '0') }}:00</td>
              <td
                v-for="d in 7"
                :key="d"
                class="course-cell"
              >
                <div
                  v-for="(course, ci) in getTimetableCourses(hour, d)"
                  :key="ci"
                  class="cell-course"
                  :style="{ borderLeftColor: course.color }"
                >
                  <span class="cell-name">{{ course.student_name }}</span>
                  <span class="cell-time">{{ course.start_time }}-{{ course.end_time }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import { getCoursesRange, logout as logoutApi } from '../api/index.js'

const router = useRouter()

const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const weekDayHeaders = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const timeSlots = Array.from({ length: 18 }, (_, i) => i + 6) // 06:00 - 23:00
const todayStr = dayjs().format('YYYY-MM-DD')

const currentMonth = ref(dayjs().format('YYYY-MM'))
const activeDate = ref(todayStr)
const monthCourses = ref([])

// 获取当前教师信息
const teacherInfo = JSON.parse(localStorage.getItem('teacher') || '{}')
const teacherName = teacherInfo.name || ''

const monthLabel = computed(() => dayjs(currentMonth.value).format('YYYY 年 M 月'))

const calendarDays = computed(() => {
  const m = dayjs(currentMonth.value)
  const startOfMonth = m.startOf('month')
  const endOfMonth = m.endOf('month')
  const startDow = startOfMonth.day()
  const daysInMonth = m.daysInMonth()
  const result = []

  // 上个月补齐
  const prevMonth = m.subtract(1, 'month')
  const prevDays = prevMonth.daysInMonth()
  for (let i = startDow - 1; i >= 0; i--) {
    const dateStr = prevMonth.date(prevDays - i).format('YYYY-MM-DD')
    result.push(buildDay(prevDays - i, dateStr, false))
  }

  // 当月
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = m.date(d).format('YYYY-MM-DD')
    result.push(buildDay(d, dateStr, true))
  }

  // 下个月补齐（42格 = 6行）
  const remaining = 42 - result.length
  const nextMonth = m.add(1, 'month')
  for (let d = 1; d <= remaining; d++) {
    const dateStr = nextMonth.date(d).format('YYYY-MM-DD')
    result.push(buildDay(d, dateStr, false))
  }

  return result
})

function buildDay(dayNum, dateStr, isCurrentMonth) {
  const students = monthCourses.value
    .filter(c => c.date === dateStr)
    .map(c => ({
      name: c.student_name,
      time: `${c.start_time}-${c.end_time}`,
      color: c.color || '#409EFF',
      teacherName: c.teacher_name || '',
      repeatType: c.repeat_type || 'none'
    }))
  return { dayNum, dateStr, isCurrentMonth, students }
}

function changeMonth(delta) {
  currentMonth.value = dayjs(currentMonth.value).add(delta, 'month').format('YYYY-MM')
}

function goToDay(dateStr) {
  activeDate.value = dateStr
  router.push({ name: 'day-detail', params: { date: dateStr } })
}

function backToToday() {
  currentMonth.value = dayjs().format('YYYY-MM')
  goToDay(todayStr)
}

// 周课程表数据：按月数据聚合，按 weekday + hour 去重
const timetableMap = computed(() => {
  const map = {}
  const seen = new Set()
  for (const c of monthCourses.value) {
    const d = dayjs(c.date)
    const dow = d.day() || 7 // 1=Mon..7=Sun
    const hour = parseInt(c.start_time.split(':')[0])
    const key = `${dow}-${hour}`
    // 用 student_name + start_time + end_time 去重（同一学生同一时间只显示一次）
    const dedupKey = `${dow}-${hour}-${c.student_name}-${c.start_time}-${c.end_time}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)
    if (!map[key]) map[key] = []
    map[key].push(c)
  }
  return map
})

// 获取 timetable 某小时某周的课程
function getTimetableCourses(hour, weekday) {
  return timetableMap.value[`${weekday}-${hour}`] || []
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确认退出登录？', '退出', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'info'
    })
    // 用户确认退出
    try { await logoutApi() } catch { /* 忽略接口报错 */ }
    localStorage.removeItem('token')
    localStorage.removeItem('teacher')
    router.push('/login')
  } catch {
    // 用户点了取消，什么都不做
  }
}

async function loadMonthCourses() {
  const m = dayjs(currentMonth.value)
  const start = m.startOf('month').subtract(7, 'day').format('YYYY-MM-DD')
  const end = m.endOf('month').add(7, 'day').format('YYYY-MM-DD')
  try {
    const res = await getCoursesRange(start, end)
    monthCourses.value = res.data.data || []
  } catch (err) {
    console.error('加载月历数据失败:', err)
  }
}

watch(currentMonth, () => { loadMonthCourses() })

// 从详情页返回时重新加载数据
watch(() => router.currentRoute.value.name, (name) => {
  if (name === 'calendar') loadMonthCourses()
})

onMounted(() => {
  loadMonthCourses()
})
</script>

<style scoped>
@import "../assets/css/calendar.css";

.title-icon { height: 1.8em; width: auto; display: block; }
</style>
