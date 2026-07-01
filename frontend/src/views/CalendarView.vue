<template>
  <div class="calendar-page">
    <header class="cal-header">
      <div class="cal-header-top">
        <h1 class="cal-title">📚 {{ teacherName }}的课程表</h1>
        <div class="cal-user">
          <span class="cal-user-name">{{ teacherName }}</span>
          <el-button size="small" @click="handleLogout">退出</el-button>
        </div>
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
                ><span class="tag-name">{{ s.name }}</span><span v-if="s.teacherName" class="tag-teacher">{{ s.teacherName }}</span> <span class="tag-time">{{ s.time }}</span></span>
                <span v-if="day.students.length > 4" class="cal-student-more">+{{ day.students.length - 4 }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </header>
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
      teacherName: c.teacher_name || ''
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

onMounted(() => {
  loadMonthCourses()
})
</script>

<style scoped>
.calendar-page {
  min-height: 100vh;
  background: #f5f7fa;
}
.cal-header {
  max-width: 920px;
  margin: 0 auto;
  padding: 24px 20px 20px;
  color: #303133;
}
.cal-header-top {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cal-title {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  letter-spacing: 1px;
}
.cal-user {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cal-user-name {
  font-size: 14px;
  color: #606266;
  background: #ecf5ff;
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: 500;
}
.cal-user .el-button {
  --el-button-bg-color: #fff;
  --el-button-border-color: #dcdfe6;
  --el-button-text-color: #909399;
  --el-button-hover-text-color: #f56c6c;
  --el-button-hover-border-color: #f56c6c;
}
.cal-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.cal-nav .el-button {
  --el-button-bg-color: #fff;
  --el-button-border-color: #dcdfe6;
  --el-button-text-color: #606266;
  --el-button-hover-bg-color: #ecf5ff;
  --el-button-hover-border-color: #c6e2ff;
  --el-button-hover-text-color: #409eff;
  --el-button-active-bg-color: #ecf5ff;
}
.cal-month-title {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
  min-width: 140px;
  text-align: center;
}

/* 月历网格 */
.cal-grid {
  user-select: none;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  padding: 12px 12px 8px;
}
.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 4px;
}
.cal-weekdays span {
  text-align: center;
  font-size: 13px;
  padding: 6px 0;
  color: #909399;
  font-weight: 600;
}
.cal-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.cal-day {
  min-height: 76px;
  background: #fafafa;
  border-radius: 6px;
  padding: 4px 6px;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
  border: 1px solid #f0f0f0;
}
.cal-day:hover {
  background: #ecf5ff;
  border-color: #c6e2ff;
}
.cal-day--empty {
  visibility: hidden;
}
.cal-day--today {
  background: #ecf5ff !important;
  border-color: #409eff !important;
  box-shadow: 0 0 0 1px #409eff;
}
.cal-day--other {
  opacity: 0.45;
}
.cal-day-number {
  font-size: 15px;
  font-weight: 700;
  color: #303133;
  line-height: 1.5;
}
.cal-day--other .cal-day-number {
  color: #c0c4cc;
}
.cal-day-students {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 3px;
  flex: 1;
}
.cal-student-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  line-height: 1.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
}
.tag-name {
  font-weight: 600;
}
.tag-teacher {
  font-weight: 400;
  font-size: 9px;
  opacity: 0.65;
  margin-left: 2px;
}
.tag-time {
  font-weight: 400;
  opacity: 0.75;
  font-size: 10px;
}
.cal-student-more {
  font-size: 11px;
  color: #909399;
  line-height: 1.6;
  padding-left: 4px;
  font-weight: 500;
}

@media (max-width: 640px) {
  .cal-header { padding: 16px 10px 12px; }
  .cal-title { font-size: 18px; }
  .cal-day { min-height: 58px; padding: 3px; }
  .cal-day-number { font-size: 13px; }
  .cal-student-tag { font-size: 10px; padding: 0 4px; }
}
</style>
