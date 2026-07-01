<template>
  <div class="detail-page">
    <!-- 顶部面包屑导航 -->
    <header class="detail-header">
      <div class="detail-header-row">
        <el-button class="back-btn" @click="goBack">&lt; 返回月历</el-button>
        <h1 class="detail-title">📚 {{ teacherName }}的课程表</h1>
        <div class="detail-user">
          <span class="detail-user-name">{{ teacherName }}</span>
          <el-button size="small" class="detail-logout-btn" @click="handleLogout">退出</el-button>
        </div>
      </div>
      <!-- 日导航 -->
      <div class="detail-nav">
        <el-button-group>
          <el-button @click="changeDay(-1)">&lt; 前一天</el-button>
          <el-button @click="backToToday" :type="isToday ? '' : 'default'">今天</el-button>
          <el-button @click="changeDay(1)">后一天 &gt;</el-button>
        </el-button-group>
        <div class="detail-nav-date">{{ dayTitle }}</div>
        <div class="detail-stats">
          <el-tag type="info" size="small">课程: {{ courses.length }}</el-tag>
          <el-tag type="success" size="small" style="margin-left:6px">{{ totalDuration }}</el-tag>
          <el-divider direction="vertical" style="margin: 0 8px;" />
          <span class="switch-label" :class="{ 'is-active': !hideStudentName }">姓名</span>
          <el-switch v-model="hideStudentName" size="small" style="margin: 0 4px;" />
          <span class="switch-label" :class="{ 'is-active': hideStudentName }">隐藏</span>
        </div>
      </div>
    </header>

    <!-- 时间轴 -->
    <div class="timeline-wrapper" ref="timelineWrapper">
      <div class="timeline">
        <div
          v-for="hour in 24"
          :key="hour"
          class="hour-slot"
          :style="{ height: HOUR_HEIGHT + 'px' }"
          @click="onSlotClick(hour - 1, 0)"
        >
          <div class="hour-label">{{ String(hour - 1).padStart(2, '0') }}:00</div>
          <div class="hour-grid">
            <div v-for="min in 4" :key="min" class="minute-marker" :style="{ left: (min * 25) + '%' }">
              <span class="minute-text">{{ min * 15 }}</span>
            </div>
          </div>
        </div>

        <!-- 课程块 -->
        <div
          v-for="course in courses"
          :key="course.id"
          class="course-block"
          :style="getCourseStyle(course)"
          @click.stop="editCourse(course)"
        >
          <div class="course-inner" :style="{ backgroundColor: course.color + '20', borderLeftColor: course.color }">
            <div class="course-time">{{ course.start_time }} - {{ course.end_time }}</div>
            <div v-if="!hideStudentName" class="course-student">{{ course.student_name }}</div>
            <div v-if="!hideStudentName && course.description" class="course-desc">{{ course.description }}</div>
          </div>
        </div>

        <div v-if="isToday && nowLineTop >= 0" class="now-line" :style="{ top: nowLineTop + 'px' }">
          <div class="now-dot"></div>
          <div class="now-label">{{ nowTimeStr }}</div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑课程' : '添加课程'"
      width="500px"
      :close-on-click-modal="false"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form :model="courseForm" label-width="80px" size="large">
        <el-form-item label="学生姓名" required label-for="student_name">
          <el-input id="student_name" v-model="courseForm.student_name" placeholder="请输入学生姓名" />
        </el-form-item>
        <el-form-item label="日期" label-for="course_date">
          <el-date-picker
            id="course_date"
            v-model="courseForm.date"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="开始时间" required label-for="course_start">
          <el-time-picker
            id="course_start"
            v-model="courseForm.startTime"
            placeholder="选择开始时间"
            format="HH:mm"
            value-format="HH:mm"
            :disabled-hours="disabledStartHours"
            :disabled-minutes="disabledStartMinutes"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束时间" required label-for="course_end">
          <el-time-picker
            id="course_end"
            v-model="courseForm.endTime"
            placeholder="选择结束时间"
            format="HH:mm"
            value-format="HH:mm"
            :disabled-hours="disabledEndHours"
            :disabled-minutes="disabledEndMinutes"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="颜色" label-for="course_color">
          <el-color-picker id="course_color" v-model="courseForm.color" />
        </el-form-item>
        <el-form-item label="备注" label-for="course_desc">
          <el-input
            id="course_desc"
            v-model="courseForm.description"
            type="textarea"
            :rows="2"
            placeholder="可选备注信息"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button v-if="isEditing" type="danger" @click="deleteCourse" :loading="deleting">删除</el-button>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveCourse" :loading="saving">
            {{ isEditing ? '保存修改' : '添加' }}
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse as deleteCourseApi,
  logout as logoutApi
} from '../api/index.js'

const HOUR_HEIGHT = 64

const router = useRouter()
const route = useRoute()

// 当前教师
const teacherInfo = JSON.parse(localStorage.getItem('teacher') || '{}')
const teacherName = teacherInfo.name || ''

const hideStudentName = ref(false)
const dateStr = ref(route.params.date || dayjs().format('YYYY-MM-DD'))
const courses = ref([])
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const deleting = ref(false)
const timelineWrapper = ref(null)

// 当前时间线
const nowLineTop = ref(-1)
const nowTimeStr = ref('')
let nowTimer = null

const todayStr = dayjs().format('YYYY-MM-DD')
const isToday = computed(() => dateStr.value === todayStr)

const dayTitle = computed(() => {
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const d = dayjs(dateStr.value)
  return `${d.format('M 月 D 日')} ${days[d.day()]}`
})

const totalDuration = computed(() => {
  let total = 0
  for (const c of courses.value) {
    const [sh, sm] = c.start_time.split(':').map(Number)
    const [eh, em] = c.end_time.split(':').map(Number)
    total += (eh * 60 + em) - (sh * 60 + sm)
  }
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h}小时${m}分钟` : `${m}分钟`
})

function getDefaultForm() {
  return {
    student_name: '',
    date: dateStr.value,
    startTime: '08:00',
    endTime: '09:00',
    color: '#409EFF',
    description: ''
  }
}

const courseForm = ref(getDefaultForm())

// 不可选时间
const disabledStartHours = computed(() => () => {
  if (!courseForm.value.endTime) return []
  const [eh] = courseForm.value.endTime.split(':').map(Number)
  return Array.from({ length: 24 - eh - 1 }, (_, i) => eh + 1 + i)
})
const disabledStartMinutes = computed(() => (hour) => {
  if (!courseForm.value.endTime) return []
  const [eh, em] = courseForm.value.endTime.split(':').map(Number)
  if (hour === eh) return Array.from({ length: 60 - em }, (_, i) => em + i)
  return []
})
const disabledEndHours = computed(() => () => {
  if (!courseForm.value.startTime) return []
  const [sh] = courseForm.value.startTime.split(':').map(Number)
  return Array.from({ length: sh }, (_, i) => i)
})
const disabledEndMinutes = computed(() => (hour) => {
  if (!courseForm.value.startTime) return []
  const [sh, sm] = courseForm.value.startTime.split(':').map(Number)
  if (hour === sh) return Array.from({ length: sm + 1 }, (_, i) => i)
  return []
})

// 方法
function goBack() {
  router.push({ name: 'calendar' })
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确认退出登录？', '退出', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'info'
    })
    try { await logoutApi() } catch { /* 忽略接口报错 */ }
    localStorage.removeItem('token')
    localStorage.removeItem('teacher')
    router.push('/login')
  } catch {
    // 用户点了取消，什么都不做
  }
}

function changeDay(delta) {
  dateStr.value = dayjs(dateStr.value).add(delta, 'day').format('YYYY-MM-DD')
  router.replace({ params: { date: dateStr.value } })
  loadCourses()
  nextTick(() => scrollToSuitable())
}

function backToToday() {
  dateStr.value = todayStr
  router.replace({ params: { date: todayStr } })
  loadCourses()
  nextTick(() => scrollToSuitable())
}

function scrollToSuitable() {
  if (!timelineWrapper.value) return
  if (isToday.value) {
    const now = dayjs()
    const top = now.hour() * HOUR_HEIGHT + (now.minute() / 60) * HOUR_HEIGHT - HOUR_HEIGHT * 1.5
    timelineWrapper.value.scrollTop = Math.max(0, top)
  } else {
    timelineWrapper.value.scrollTop = 0
  }
}

async function loadCourses() {
  try {
    const res = await getCourses(dateStr.value)
    courses.value = res.data.data || []
  } catch (err) {
    console.error('加载课程失败:', err)
  }
}

function updateNowLine() {
  if (isToday.value) {
    const now = dayjs()
    nowLineTop.value = now.hour() * HOUR_HEIGHT + (now.minute() / 60) * HOUR_HEIGHT
    nowTimeStr.value = now.format('HH:mm')
  } else {
    nowLineTop.value = -1
  }
}

function onSlotClick(hour, minute) {
  const roundedMinute = Math.floor(minute / 15) * 15
  const startTime = `${String(hour).padStart(2, '0')}:${String(roundedMinute).padStart(2, '0')}`
  let endHour = hour + 1
  if (endHour >= 24) endHour = 23
  const endTime = `${String(endHour).padStart(2, '0')}:${String(roundedMinute).padStart(2, '0')}`
  openAddDialog(startTime, endTime)
}

function openAddDialog(startTime, endTime) {
  isEditing.value = false
  editingId.value = null
  courseForm.value = { ...getDefaultForm(), startTime, endTime }
  dialogVisible.value = true
}

function editCourse(course) {
  isEditing.value = true
  editingId.value = course.id
  courseForm.value = {
    student_name: course.student_name,
    date: course.date,
    startTime: course.start_time,
    endTime: course.end_time,
    color: course.color || '#409EFF',
    description: course.description || ''
  }
  dialogVisible.value = true
}

function resetForm() {
  courseForm.value = getDefaultForm()
  isEditing.value = false
  editingId.value = null
  saving.value = false
  deleting.value = false
}

async function saveCourse() {
  if (!courseForm.value.student_name.trim()) {
    ElMessage.warning('请输入学生姓名')
    return
  }
  if (courseForm.value.startTime >= courseForm.value.endTime) {
    ElMessage.warning('结束时间必须晚于开始时间')
    return
  }
  saving.value = true
  try {
    const data = {
      student_name: courseForm.value.student_name.trim(),
      date: courseForm.value.date,
      start_time: courseForm.value.startTime,
      end_time: courseForm.value.endTime,
      color: courseForm.value.color || '#409EFF',
      description: courseForm.value.description || ''
    }
    if (isEditing.value) {
      await updateCourse(editingId.value, data)
      ElMessage.success('课程已更新')
    } else {
      await createCourse(data)
      ElMessage.success('课程已添加')
    }
    dialogVisible.value = false
    loadCourses()
  } catch (err) {
    console.error('保存失败:', err)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function deleteCourse() {
  try {
    await ElMessageBox.confirm('确定要删除这门课程吗？', '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    deleting.value = true
    await deleteCourseApi(editingId.value)
    ElMessage.success('课程已删除')
    dialogVisible.value = false
    loadCourses()
  } catch (err) {
    if (err !== 'cancel') console.error('删除失败:', err)
  } finally {
    deleting.value = false
  }
}

function getCourseStyle(course) {
  const [sh, sm] = course.start_time.split(':').map(Number)
  const [eh, em] = course.end_time.split(':').map(Number)
  const top = ((sh * 60 + sm) / 60) * HOUR_HEIGHT
  const height = Math.max((((eh * 60 + em) - (sh * 60 + sm)) / 60) * HOUR_HEIGHT, 20)
  return { top: top + 'px', height: height + 'px' }
}

// 监听路由参数变化（用户从月历点击其他日期进入）
watch(() => route.params.date, (newDate) => {
  if (newDate && newDate !== dateStr.value) {
    dateStr.value = newDate
    loadCourses()
    nextTick(() => scrollToSuitable())
  }
})

onMounted(() => {
  dateStr.value = route.params.date || dayjs().format('YYYY-MM-DD')
  loadCourses()
  updateNowLine()
  nowTimer = setInterval(updateNowLine, 60000)
  nextTick(() => scrollToSuitable())
})

onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer)
})
</script>

<style scoped>
.detail-page {
  max-width: 920px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  box-shadow: 0 0 20px rgba(0,0,0,0.05);
}

/* 顶部 */
.detail-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 14px 20px 10px;
  position: sticky;
  top: 0;
  z-index: 100;
}
.detail-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.detail-user {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.detail-user-name {
  font-size: 13px;
  color: rgba(255,255,255,0.9);
  background: rgba(255,255,255,0.15);
  padding: 3px 12px;
  border-radius: 20px;
  font-weight: 500;
}
.detail-logout-btn {
  --el-button-bg-color: rgba(255,255,255,0.1);
  --el-button-border-color: rgba(255,255,255,0.3);
  --el-button-text-color: rgba(255,255,255,0.8);
  --el-button-hover-bg-color: rgba(245,108,108,0.3);
  --el-button-hover-border-color: #f56c6c;
  --el-button-hover-text-color: #fff;
}
.back-btn {
  --el-button-bg-color: rgba(255,255,255,0.15);
  --el-button-border-color: rgba(255,255,255,0.3);
  --el-button-text-color: #fff;
  --el-button-hover-bg-color: rgba(255,255,255,0.25);
}
.detail-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 1px;
}
.detail-nav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.detail-nav .el-button {
  --el-button-bg-color: rgba(255,255,255,0.15);
  --el-button-border-color: rgba(255,255,255,0.3);
  --el-button-text-color: #fff;
  --el-button-hover-bg-color: rgba(255,255,255,0.25);
}
.detail-nav-date {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
}
.detail-stats {
  margin-left: auto;
  display: flex;
  align-items: center;
}
.switch-label {
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  transition: color 0.2s;
}
.switch-label.is-active {
  color: #fff;
  font-weight: 600;
}

/* 时间轴 - 同原有样式 */
.timeline-wrapper {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  background: #fff;
}
.timeline-wrapper::-webkit-scrollbar { width: 8px; }
.timeline-wrapper::-webkit-scrollbar-thumb { background: #ddd; border-radius: 4px; }
.timeline-wrapper::-webkit-scrollbar-track { background: transparent; }
.timeline {
  position: relative;
  min-height: calc(24 * 64px);
  padding-left: 70px;
  padding-right: 16px;
}
.hour-slot {
  position: relative;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.15s;
}
.hour-slot:hover { background: #fafbff; }
.hour-slot:last-child { border-bottom: none; }
.hour-label {
  position: absolute;
  left: -70px; top: -9px;
  width: 60px; text-align: right;
  font-size: 13px; color: #999;
  font-weight: 500; user-select: none;
}
.hour-grid {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
}
.minute-marker {
  position: absolute; top: 0; bottom: 0;
  width: 1px; background: #f5f5f5;
}
.minute-text {
  position: absolute; top: 2px; left: 4px;
  font-size: 10px; color: #ddd; white-space: nowrap;
}
.hour-slot:nth-child(odd) { background: #fcfcfc; }

.course-block {
  position: absolute; left: 0; right: 16px;
  z-index: 10; cursor: pointer; padding: 1px 0;
}
.course-inner {
  height: 100%; border-radius: 6px;
  padding: 2px 10px; border-left: 4px solid;
  display: flex; flex-direction: column;
  overflow: hidden;
  transition: box-shadow 0.2s, transform 0.15s;
}
.course-inner:hover {
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
  transform: translateX(2px);
}
.course-time {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px; color: #999;
  font-weight: 500; line-height: 1.4;
}
.course-student { font-size: 14px; font-weight: 600; color: #333; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; }
.course-desc { font-size: 11px; color: #999; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; }

.now-line {
  position: absolute; left: 0; right: 16px;
  height: 2px; background: #e74c3c; z-index: 20; pointer-events: none;
}
.now-dot {
  position: absolute; left: -4px; top: -4px;
  width: 10px; height: 10px; background: #e74c3c; border-radius: 50%;
}
.now-label {
  position: absolute; right: -40px; top: -8px;
  font-size: 11px; color: #e74c3c; font-weight: 600; white-space: nowrap;
}

.dialog-footer { display: flex; justify-content: space-between; align-items: center; }
:deep(.el-dialog) { border-radius: 12px; }
:deep(.el-dialog__header) { margin-right: 0 !important; }

@media (max-width: 640px) {
  .detail-header { padding: 10px 12px; }
  .detail-title { font-size: 15px; }
  .detail-nav-date { font-size: 13px; }
  .timeline { padding-left: 50px; padding-right: 8px; }
  .hour-label { left: -50px; width: 42px; font-size: 11px; }
  .course-student { font-size: 12px; }
}
</style>
