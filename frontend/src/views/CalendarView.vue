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
        <h2 class="timetable-title">📅 {{ monthLabel }}（周）课程安排</h2>
        <div class="timetable-switch">
          <span class="switch-label" :class="{ 'is-active': !hideStudentName }">姓名</span>
          <el-switch v-model="hideStudentName" size="small" style="margin: 0 4px;" />
          <span class="switch-label" :class="{ 'is-active': hideStudentName }">隐藏</span>
        </div>
      </div>
      <div class="timetable-scroll">
        <el-table
          :data="timetableRows"
          :span-method="timetableSpanMethod"
          border
          :show-header="true"
          :cell-class-name="cellClassName"
          :header-cell-style="{ textAlign: 'center', backgroundColor: '#f5f7fa', color: '#606266', fontWeight: '600', borderRight: 'none' }"
          style="width:100%"
          size="small"
        >
          <el-table-column label="" width="100" prop="timeLabel" />
          <el-table-column v-for="(d, idx) in weekDayHeaders" :key="d" :label="d" min-width="85" header-align="center">
            <template #default="{ row }">
              <div
                v-for="(course, ci) in (row.days[idx] || [])"
                :key="course.id || `c-${idx}-${ci}`"
                class="cell-course"
                :style="{ background: course.color + '30', color: course.color }"
              >
                <span :class="['cell-name', { 'cell-name--hidden': hideStudentName }]">{{ course.student_name }}</span>
                <span class="cell-time">{{ course.start_time }}-{{ course.end_time }}</span>
                <span v-if="course.repeat_type === 'weekly'" class="cell-repeat">🔄</span>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { getHoliday, loadHolidays } from '../assets/js/holidays.js'
import { getCoursesRange } from '../api/index.js'

const router = useRouter()
const route = useRoute()

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

// 周课程表数据：按当月数据聚合
// 课程会加入它覆盖的每个小时格子（不再使用跨行合并，避免隐藏同一时段的其他课程）
const timetableMap = computed(() => {
  const m = dayjs(currentMonth.value)
  const monthStart = m.startOf('month').format('YYYY-MM-DD')
  const monthEnd = m.endOf('month').format('YYYY-MM-DD')
  const map = {}
  const seen = new Set() // 每周重复去重
  for (const c of monthCourses.value) {
    if (c.date < monthStart || c.date > monthEnd) continue
    const d = dayjs(c.date)
    const dow = d.day() || 7 // 1=Mon..7=Sun
    const [sh, sm] = c.start_time.split(':').map(Number)
    const [eh, em] = c.end_time.split(':').map(Number)
    const startHour = sh
    const durationMins = eh * 60 + em - (sh * 60 + sm)
    const spanRows = Math.max(1, Math.ceil(durationMins / 60))
    // 每周重复去重：同一天+同一时段+同学生只显示一次
    const dedupKey = `${dow}-${startHour}-${c.student_name}-${c.start_time}-${c.end_time}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)
    // 将课程加入它覆盖的每个小时格子，确保同一格子的所有课程都能独立显示
    for (let o = 0; o < spanRows; o++) {
      const hour = startHour + o
      const key = `${dow}-${hour}`
      if (!map[key]) map[key] = []
      map[key].push(c)
    }
  }
  return map
})

// 获取 timetable 某小时某周的课程
function getTimetableCourses(hour, weekday) {
  return timetableMap.value[`${weekday}-${hour}`] || []
}

// el-table 行数据
// 每个小时格子独立显示，不再使用跨行合并覆盖逻辑
const timetableRows = computed(() => {
  return timeSlots.map(hour => {
    const row = { hour, timeLabel: String(hour).padStart(2, '0') + ':00~' + String(hour+1).padStart(2, '0') + ':00', days: [] }
    for (let d = 1; d <= 7; d++) {
      row.days.push(getTimetableCourses(hour, d))
    }
    return row
  })
})

function timetableSpanMethod() {
  // 不再使用跨行合并，每个小时格子独立显示
}

function cellClassName({ row, column, columnIndex }) {
  if (columnIndex === 0) return 'time-cell'
  return 'course-cell'
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

// 从 query 参数恢复月份
function restoreMonthFromQuery() {
  const month = route.query.month
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    currentMonth.value = month
  }
}

watch(() => route.query.month, () => {
  restoreMonthFromQuery()
})

onMounted(() => {
  restoreMonthFromQuery()
  loadMonthCourses()
  loadHolidays(dayjs().year()).then(() => { holidayVersion.value++ })
})

</script>

<style scoped>
@import "../assets/css/calendar.css";
</style>
