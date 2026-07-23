<template>
  <div class="detail-page">
    <!-- 顶部面包屑导航 -->
    <header class="detail-header">
      <div class="detail-header-row">
        <el-button class="back-btn" @click="goBack">&lt; 返回月历</el-button>
        <h1 class="detail-title"><img src="../assets/images/logo.svg" class="title-icon" alt="课表侠" /> {{ teacherName }}的课程表</h1>
        
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

    <!-- 分列头（admin 多教师重叠时显示） -->
    <div v-if="laneHeaders.length > 0" class="lane-headers">
      <div
        v-for="h in laneHeaders"
        :key="h.teacher"
        class="lane-header"
        :style="{ width: h.width + '%', left: h.left + '%' }"
      >
        {{ h.teacher }}
      </div>
    </div>

    <!-- 时间轴 -->
    <div class="timeline-wrapper" ref="timelineWrapper">
      <div class="timeline">
        <div
          v-for="hour in 18"
          :key="hour"
          class="hour-slot"
          :style="{ height: HOUR_HEIGHT + 'px' }"
          @click="onSlotClick(hour + 5, 0)"
        >
          <div class="hour-label">{{ String(hour + 5).padStart(2, '0') }}:00</div>
          <div class="hour-grid">
            <div v-for="min in 4" :key="min" class="minute-marker" :style="{ left: (min * 25) + '%' }">
              <span class="minute-text">{{ min * 15 }}</span>
            </div>
          </div>
        </div>

        <!-- 课程块 -->
        <div
          v-for="course in displayCourses"
          :key="course.id"
          class="course-block"
          :class="{ 'course-block--lane': course.laneCount > 1 }"
          :style="getCourseStyle(course)"
          @click.stop="editCourse(course)"
        >
          <div class="course-inner" :style="{ backgroundColor: course.color + '20', borderLeftColor: course.color }">
            <div v-if="!hideStudentName" class="course-student">
              {{ course.student_name }}
              <span v-if="course.teacher_name" class="course-teacher">（{{ course.teacher_name }}）</span>
            </div>
            <div class="course-time">
              <span v-if="course.repeat_type === 'weekly'" class="repeat-badge">🔄每周</span>
              <span v-if="course.repeat_type === 'weekdays'" class="repeat-badge">🔄工作日</span>
              {{ course.start_time }} - {{ course.end_time }}
            </div>
            <div v-if="!hideStudentName" class="course-meta">
              <span v-if="course.grade" class="meta-item">{{ course.grade }}</span>
              <span v-if="course.hourly_fee" class="meta-item">{{ course.hourly_fee }}元/时</span>
              <span class="meta-item" :class="course.attended ? 'meta-attended-yes' : 'meta-attended-no'">
                {{ course.attended ? '✅已到' : '❌未到' }}
              </span>
            </div>
          </div>
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
          <el-autocomplete
            id="student_name"
            v-model="courseForm.student_name"
            :fetch-suggestions="queryStudents"
            :trigger-on-focus="false"
            placeholder="输入学生姓名搜索或新建"
            value-key="name"
            clearable
            @select="onStudentSelect"
            style="width: 100%"
          >
            <template #default="{ item }">
              <div class="student-suggestion">{{ item.name }} <span v-if="item.grade" class="suggestion-grade">{{ item.grade }}</span></div>
            </template>
          </el-autocomplete>
        </el-form-item>
        <el-form-item v-if="canSelectTeacher" label="教师" label-for="course_teacher">
          <el-select id="course_teacher" v-model="courseForm.teacher_id" placeholder="选择教师" style="width:100%">
            <el-option v-for="t in teacherOptions" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
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
        <el-form-item label="年级" required label-for="course_grade">
          <el-select id="course_grade" v-model="courseForm.grade" placeholder="选择年级" style="width: 100%">
            <el-option v-for="g in gradeOptions" :key="g.id" :label="g.name" :value="g.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="单价" required label-for="course_fee">
          <el-input
            id="course_fee"
            v-model="courseForm.hourly_fee"
            placeholder="只能输入数字（每小时课时费）"
            type="number"
            min="0"
          >
            <template #append>元</template>
          </el-input>
        </el-form-item>
        <el-form-item label="重复" label-for="course_repeat">
          <el-radio-group id="course_repeat" v-model="courseForm.repeat_type">
            <el-radio value="none">不重复</el-radio>
            <el-radio value="weekly">每周（{{ weekDayOfDate(courseForm.date) }}）</el-radio>
            <el-radio value="weekdays">每周（工作日）</el-radio>
          </el-radio-group>
          <div v-if="courseForm.repeat_type === 'weekdays'" class="repeat-hint">
            📌 将在每周一至周五的 {{ courseForm.startTime }} 自动创建课程，跳过法定节假日
          </div>
        </el-form-item>
        <el-form-item v-if="courseForm.repeat_type !== 'none'" label="截止日期" label-for="course_end_date">
          <el-date-picker
            id="course_end_date"
            v-model="courseForm.end_date"
            type="date"
            placeholder="不填则自动生成一年"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 200px"
            :disabled-date="disableEndDate"
          />
        </el-form-item>
        <el-form-item label="签到" label-for="course_attended">
          <el-switch
            id="course_attended"
            v-model="courseForm.attended"
            active-text="已到课"
            inactive-text="未到课"
            :disabled="isFutureCourse"
          />
          <el-tooltip v-if="isFutureCourse" content="只能修改当天及之前的课程签到" placement="top">
            <span style="margin-left:4px;cursor:help;color:#909399">ℹ️</span>
          </el-tooltip>
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
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse as deleteCourseApi,
  getStudents,
  getStudentRecentFee
} from '../api/index.js'

const HOUR_HEIGHT = 64
const START_HOUR = 6

const router = useRouter()
const route = useRoute()

// 当前教师
const teacherInfo = JSON.parse(localStorage.getItem('teacher') || '{}')
const teacherName = teacherInfo.name || ''
const isAdmin = computed(() => teacherInfo.id === 1)
const teacherRole = teacherInfo.role || 'teacher'
const canSelectTeacher = teacherRole === 'super_admin' || teacherRole === 'manager'
const teacherOptions = ref([])

async function loadTeachersForCourse() {
  if (!canSelectTeacher) return
  try {
    const res = await getTeachers()
    teacherOptions.value = res.data.data || []
  } catch {}
}

// 处理课程显示：admin 遇到多教师时间重叠时，按老师分列
const displayCourses = computed(() => {
  const items = courses.value.map(c => ({ ...c }))
  if (!isAdmin.value || items.length < 2) return items

  // 按开始时间排序
  items.sort((a, b) => a.start_time.localeCompare(b.start_time))

  // 找出跨教师的时间重叠（两两比较），标记需要分列的课程
  const needsLane = new Set()
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      // 判断是否重叠：A 在 B 结束前开始 且 A 在 B 开始后结束
      const overlap = items[i].start_time < items[j].end_time && items[i].end_time > items[j].start_time
      if (overlap && items[i].teacher_id !== items[j].teacher_id) {
        needsLane.add(items[i].id)
        needsLane.add(items[j].id)
      }
    }
  }

  if (needsLane.size === 0) return items

  // 按 teacher_id 分配车道
  const laneMap = {}
  let laneIdx = 0
  for (const c of items) {
    if (needsLane.has(c.id) && !(c.teacher_id in laneMap)) {
      laneMap[c.teacher_id] = laneIdx++
    }
  }
  const laneCount = Object.keys(laneMap).length

  for (const c of items) {
    if (needsLane.has(c.id)) {
      c.laneIndex = laneMap[c.teacher_id]
      c.laneCount = laneCount
    } else {
      c.laneIndex = 0
      c.laneCount = 1
    }
  }

  return items
})

// 分列头：仅 admin 且有多列时显示
const laneHeaders = computed(() => {
  if (!isAdmin.value) return []
  const laneTeachers = {}
  for (const c of displayCourses.value) {
    if (c.laneCount > 1 && c.teacher_name && !(c.laneIndex in laneTeachers)) {
      laneTeachers[c.laneIndex] = c.teacher_name
    }
  }
  const keys = Object.keys(laneTeachers)
  if (keys.length < 2) return []
  const count = keys.length
  return keys.map(k => ({
    teacher: laneTeachers[k],
    left: (parseInt(k) / count) * 100,
    width: 100 / count
  }))
})

const hideStudentName = ref(false)
const dateStr = ref(route.params.date || dayjs().format('YYYY-MM-DD'))
const courses = ref([])
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref(null)
const editingRepeatGroupId = ref(null)
const editingUpdateAllFuture = ref(false)
const saving = ref(false)
const deleting = ref(false)
const timelineWrapper = ref(null)

// 当前时间线

const todayStr = dayjs().format('YYYY-MM-DD')
const isToday = computed(() => dateStr.value === todayStr)

const dayTitle = computed(() => {
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const d = dayjs(dateStr.value)
  return `${d.format('M 月 D 日')} ${days[d.day()]}`
})

// 当前编辑的课程是否属于未来（禁止修改签到）
const isFutureCourse = computed(() => {
  const cf = courseForm.value
  if (!cf || !cf.date) return false
  // 用时间戳比较日期是否在未来
  const courseDate = dayjs(cf.date).startOf('day')
  const today = dayjs().startOf('day')
  if (courseDate.valueOf() > today.valueOf()) return true
  // 今天的课程，开始时间还没到 → 禁止签到
  if (courseDate.valueOf() === today.valueOf() && cf.startTime) {
    const [h, m] = cf.startTime.split(':').map(Number)
    const courseStart = dayjs(cf.date).hour(h).minute(m)
    const now = dayjs()
    if (courseStart.valueOf() > now.valueOf()) return true
  }
  return false
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

const gradeOptions = [
  { id: 1, name: '一年级' },
  { id: 2, name: '二年级' },
  { id: 3, name: '三年级' },
  { id: 4, name: '四年级' },
  { id: 5, name: '五年级' },
  { id: 6, name: '六年级' },
  { id: 7, name: '初一' },
  { id: 8, name: '初二' },
  { id: 9, name: '初三' },
  { id: 10, name: '高一' },
  { id: 11, name: '高二' },
  { id: 12, name: '高三' }
]

const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
function weekDayOfDate(dateStr) {
  return weekDays[dayjs(dateStr).day()] || ''
}

function getDefaultForm() {
  return {
    student_name: '',
    student_id: null,
    date: dateStr.value,
    startTime: '08:00',
    endTime: '09:00',
    color: '#409EFF',
    description: '',
    grade: '',
    hourly_fee: '',
    attended: false,
    repeat_type: 'none',
    end_date: '',
    teacher_id: ''
  }
}

function disableEndDate(time) {
  // 截止日期不能早于课程创建日期
  return dateStr.value && dayjs(time).isBefore(dayjs(dateStr.value), 'day')
}

// 学生搜索（input 自动补全）
async function queryStudents(query, cb) {
  if (!query) return cb([])
  try {
    const res = await getStudents({ name: query })
    cb(res.data.data || [])
  } catch {
    cb([])
  }
}
async function onStudentSelect(student) {
  courseForm.value.student_id = student.id
  if (!courseForm.value.grade && student.grade) {
    courseForm.value.grade = student.grade
  }
  // 自动填充最近一次课时费和颜色
  try {
    const res = await getStudentRecentFee(student.id)
    if (res.data.data?.hourly_fee) {
      courseForm.value.hourly_fee = res.data.data.hourly_fee
    }
    if (res.data.data?.color) {
      courseForm.value.color = res.data.data.color
    }
  } catch { /* 忽略 */ }
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
  // 返回月历时带上当前查看的月份，让月历定位到对应月份
  const d = dayjs(dateStr.value)
  router.push('/app/calendar?month=' + d.format('YYYY-MM'))
}

function changeDay(delta) {
  dateStr.value = dayjs(dateStr.value).add(delta, 'day').format('YYYY-MM-DD')
  router.replace('/app/day/' + dateStr.value)
  loadCourses()
  nextTick(() => scrollToSuitable())
}

function backToToday() {
  dateStr.value = todayStr
  router.replace('/app/day/' + todayStr)
  loadCourses()
  nextTick(() => scrollToSuitable())
}

function scrollToSuitable() {
  if (!timelineWrapper.value) return
  if (isToday.value) {
    const now = dayjs()
    const top = ((now.hour() - START_HOUR) * 60 + now.minute()) / 60 * HOUR_HEIGHT - HOUR_HEIGHT * 1.5
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


function onSlotClick(hour, minute) {
  const actualHour = hour
  const roundedMinute = Math.floor(minute / 15) * 15
  const startTime = `${String(actualHour).padStart(2, '0')}:${String(roundedMinute).padStart(2, '0')}`
  let endHour = actualHour + 1
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
  editingRepeatGroupId.value = course.repeat_group_id || null
  courseForm.value = {
    student_name: course.student_name,
    student_id: course.student_id || null,
    date: course.date,
    startTime: course.start_time,
    endTime: course.end_time,
    color: course.color || '#409EFF',
    description: course.description || '',
    grade: course.grade || '',
    hourly_fee: course.hourly_fee || '',
    attended: !!course.attended,
    repeat_type: course.repeat_type || 'none',
    end_date: course.end_date || '',
    teacher_id: course.teacher_id ? String(course.teacher_id) : ''
  }
  dialogVisible.value = true
}

function resetForm() {
  courseForm.value = getDefaultForm()
  isEditing.value = false
  editingId.value = null
  editingRepeatGroupId.value = null
  editingUpdateAllFuture.value = false
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
  if (!courseForm.value.grade.trim()) {
    ElMessage.warning('请输入年级')
    return
  }
  if (!courseForm.value.hourly_fee || parseFloat(courseForm.value.hourly_fee) <= 0) {
    ElMessage.warning('请输入有效的课时费')
    return
  }

  // 编辑重复课程时：询问是否更新所有未来课程
  if (isEditing.value && editingRepeatGroupId.value) {
    try {
      await ElMessageBox.confirm(
        '这是一门重复课程，是否同时修改所有未来的课程？\n点"取消"只修改本节课。',
        '修改重复课程',
        {
          confirmButtonText: '修改全部未来课程',
          cancelButtonText: '只修改本节课',
          distinguishCancelAndClose: true,
          type: 'info'
        }
      )
      // 用户确认：标记更新全部
      editingUpdateAllFuture.value = true
    } catch (err) {
      if (err === 'close') return // 点X关闭 → 不保存
      // 点取消 → 只修改本节课，继续正常保存
      editingUpdateAllFuture.value = false
    }
  }

  saving.value = true
  try {
    const data = {
      student_name: courseForm.value.student_name.trim(),
      student_id: courseForm.value.student_id || null,
      date: courseForm.value.date,
      start_time: courseForm.value.startTime,
      end_time: courseForm.value.endTime,
      color: courseForm.value.color || '#409EFF',
      description: courseForm.value.description || '',
      grade: courseForm.value.grade || '',
      hourly_fee: courseForm.value.hourly_fee ? parseFloat(courseForm.value.hourly_fee) : 0,
      attended: courseForm.value.attended,
      repeat_type: courseForm.value.repeat_type || 'none',
      end_date: courseForm.value.end_date || undefined,
      teacher_id: courseForm.value.teacher_id || undefined
    }
    if (isEditing.value) {
      if (editingUpdateAllFuture.value) {
        data.update_all_future = true
      }
      await updateCourse(editingId.value, data)
      ElMessage.success('课程已更新')
    } else {
      await createCourse(data)
      if (courseForm.value.repeat_type === 'weekly') {
        ElMessage.success('课程已添加，已自动创建未来每周的课程')
      } else if (courseForm.value.repeat_type === 'weekdays') {
        ElMessage.success('课程已添加，已自动创建未来每个工作日的课程')
      } else {
        ElMessage.success('课程已添加')
      }
    }
    dialogVisible.value = false
    loadCourses()
  } catch (err) {
    console.error('保存失败:', err)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
    editingUpdateAllFuture.value = false
  }
}

async function deleteCourse() {
  try {
    let deleteParams = {}

    if (editingRepeatGroupId.value) {
      // 每周重复课程：三段选择
      const action = await ElMessageBox.confirm(
        '这是一门每周重复的课程，请选择操作：',
        '删除重复课程',
        {
          confirmButtonText: '删除全部未来课程（包含本节）',
          cancelButtonText: '只删除本节课',
          distinguishCancelAndClose: true,
          type: 'warning'
        }
      )
      // 点"删除全部未来课程"（confirm）
      deleteParams = { delete_all_future: 'true' }
    } else {
      await ElMessageBox.confirm('确定要删除这门课程吗？', '确认删除', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
    }

    deleting.value = true
    await deleteCourseApi(editingId.value, deleteParams)
    ElMessage.success('课程已删除')
    dialogVisible.value = false
    loadCourses()
  } catch (err) {
    if (err === 'cancel' || err === 'close') {
      // 用户点"只删除本节课"（cancel）→ 正常删除本节课
      if (err === 'cancel' && editingRepeatGroupId.value) {
        deleting.value = true
        await deleteCourseApi(editingId.value, {})
        ElMessage.success('课程已删除')
        dialogVisible.value = false
        loadCourses()
      }
      // 用户点了 X 关闭 → 什么都不做
    } else {
      console.error('删除失败:', err)
    }
  } finally {
    deleting.value = false
  }
}

function getCourseStyle(course) {
  const [sh, sm] = course.start_time.split(':').map(Number)
  const [eh, em] = course.end_time.split(':').map(Number)
  const topMinutes = (sh - START_HOUR) * 60 + sm
  const bottomMinutes = (eh - START_HOUR) * 60 + em
  const durationMinutes = bottomMinutes - topMinutes
  const top = (topMinutes / 60) * HOUR_HEIGHT
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 20)

  const style = { top: top + 'px', height: height + 'px' }

  // 多列模式：按车道分配宽度
  if (course.laneCount > 1) {
    const laneWidth = 100 / course.laneCount
    style.left = (course.laneIndex * laneWidth) + '%'
    style.width = laneWidth + '%'
    style.right = 'auto'
    style.padding = '1px 2px'
  }

  return style
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
  loadTeachersForCourse()
  nextTick(() => scrollToSuitable())
})
</script>

<style scoped>
@import "../assets/css/detail.css";
</style>
