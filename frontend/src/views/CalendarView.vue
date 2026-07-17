<template>
  <div class="calendar-page">
    <header class="cal-header">
      <div class="cal-header-top">
        <h1 class="cal-title"><img src="../assets/images/logo.svg" class="title-icon" alt="课表侠" /> {{ teacherName }}的课程表</h1>
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
              <div v-if="day.holiday" class="holiday-tag" :class="'holiday-tag--' + day.holiday.type">{{ day.holiday.name }}</div>
              <div class="cal-day-students" v-if="day.students.length">
                <span
                  v-for="(s, si) in day.students.slice(0, 3)"
                  :key="si"
                  class="cal-student-tag"
                  :style="{ background: s.color + '30', color: s.color }"
                ><span class="tag-name">{{ s.name }}</span><span v-if="s.teacherName" class="tag-teacher">{{ s.teacherName }}</span> <span class="tag-time">{{ s.time }}</span><span v-if="s.repeatType === 'weekly'" class="tag-repeat">🔄</span></span>
                <span v-if="day.students.length > 3" class="cal-student-more" @click.stop="goToDay(day.dateStr)">+{{ day.students.length - 3 }} 更多 →</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </header>

    <!-- 课程 timetable -->
    <div class="timetable-wrapper">
      <div class="timetable-header">
        <h2 class="timetable-title">📅 {{ monthLabel }}课程安排</h2>
        <div class="timetable-switch">
          <span class="switch-label" :class="{ 'is-active': !hideStudentName }">姓名</span>
          <el-switch v-model="hideStudentName" size="small" style="margin: 0 4px;" />
          <span class="switch-label" :class="{ 'is-active': hideStudentName }">隐藏</span>
        </div>
      </div>
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
                  :class="{ 'cell-course--span': course._spanRows > 1 }"
                  :style="{ borderLeftColor: course.color, '--span-rows': course._spanRows }"
                >
                  <span :class="['cell-name', { 'cell-name--hidden': hideStudentName }]">{{ course.student_name }}</span>
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
import { getHoliday, loadHolidays } from '../assets/js/holidays.js'
import { getCoursesRange } from '../api/index.js'

const router = useRouter()

const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const weekDayHeaders = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const timeSlots = Array.from({ length: 18 }, (_, i) => i + 6) // 06:00 - 23:00
const todayStr = dayjs().format('YYYY-MM-DD')

const currentMonth = ref(dayjs().format('YYYY-MM'))
const activeDate = ref(todayStr)
const monthCourses = ref([])
const hideStudentName = ref(false)
const holidayVersion = ref(0)

// 获取当前教师信息
const teacherInfo = JSON.parse(localStorage.getItem('teacher') || '{}')
const teacherName = teacherInfo.name || ''

const monthLabel = computed(() => dayjs(currentMonth.value).format('YYYY 年 M 月'))

const calendarDays = computed(() => {
  void holidayVersion.value
  const m = dayjs(currentMonth.value)
  const startOfMonth = m.startOf('month')
  const startDow = startOfMonth.day()
  const daysInMonth = m.daysInMonth()
  const result = []

  // 上个月补齐（但标记为不显示）
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

  // 下个月补齐（42格 = 6行），但标记为不显示
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
  const holiday = getHoliday(dateStr)
  return { dayNum, dateStr, isCurrentMonth, students, holiday }
}

function changeMonth(delta) {
  currentMonth.value = dayjs(currentMonth.value).add(delta, 'month').format('YYYY-MM')
}

function goToDay(dateStr) {
  activeDate.value = dateStr
  router.push('/app/day/' + dateStr)
}

function backToToday() {
  currentMonth.value = dayjs().format('YYYY-MM')
  goToDay(todayStr)
}

// 周课程表数据：按当月数据聚合，跨小时课程合并行
const timetableMap = computed(() => {
  const m = dayjs(currentMonth.value)
  const monthStart = m.startOf('month').format('YYYY-MM-DD')
  const monthEnd = m.endOf('month').format('YYYY-MM-DD')
  const map = {}
  const seen = new Set()
  for (const c of monthCourses.value) {
    // 只统计当月的数据
    if (c.date < monthStart || c.date > monthEnd) continue
    const d = dayjs(c.date)
    const dow = d.day() || 7 // 1=Mon..7=Sun
    const startHour = parseInt(c.start_time.split(':')[0])
    const [eh, em] = c.end_time.split(':').map(Number)
    const [sh, sm] = c.start_time.split(':').map(Number)
    const durationMins = eh * 60 + em - (sh * 60 + sm)
    const spanRows = Math.max(1, Math.ceil(durationMins / 60))
    const key = `${dow}-${startHour}`
    const dedupKey = `${dow}-${startHour}-${c.student_name}-${c.start_time}-${c.end_time}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)
    if (!map[key]) map[key] = []
    map[key].push({ ...c, _spanRows: spanRows })
  }
  return map
})

// 获取 timetable 某小时某周的课程
function getTimetableCourses(hour, weekday) {
  return timetableMap.value[`${weekday}-${hour}`] || []
}

async function loadMonthCourses() {
  const m = dayjs(currentMonth.value)
  const start = m.startOf('month').format('YYYY-MM-DD')
  const end = m.endOf('month').format('YYYY-MM-DD')
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
  loadHolidays(dayjs().year()).then(() => { holidayVersion.value++ })
})

</script>

<style scoped>
@import "../assets/css/calendar.css";
</style>
