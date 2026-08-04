<template>
  <el-dialog v-model="visible" title="添加课程" width="520px" destroy-on-close @closed="resetForm">
    <el-form :model="form" label-width="80px" size="large">
      <el-form-item label="学生姓名" required>
        <el-autocomplete
          v-model="form.student_name"
          :fetch-suggestions="queryStudents"
          :trigger-on-focus="false"
          placeholder="输入学生姓名搜索或新建"
          value-key="name"
          clearable
          @select="onStudentSelect"
          style="width:100%"
        >
          <template #default="{ item }">
            <div>{{ item.name }} <span v-if="item.grade" style="color:#999;font-size:12px">{{ item.grade }}</span></div>
          </template>
        </el-autocomplete>
      </el-form-item>

      <el-form-item v-if="isSuperAdmin" label="管理员">
        <el-select v-model="form.manager_id" placeholder="选择管理员" clearable style="width:100%" @change="onMgrChange">
          <el-option label="不指定" value="" />
          <el-option v-for="m in managerOptions" :key="m.id" :label="m.name" :value="String(m.id)" />
        </el-select>
      </el-form-item>

      <el-form-item v-if="canSelectTeacher" label="教师" required>
        <el-select v-model="form.teacher_id" placeholder="选择教师" style="width:100%">
          <el-option v-for="t in teacherOptions" :key="t.id" :label="getTeacherLabel(t)" :value="String(t.id)" />
        </el-select>
      </el-form-item>

      <el-form-item label="开始时间" required>
        <el-date-picker
          v-model="startDateTime"
          type="datetime"
          placeholder="选择开始日期时间"
          format="YYYY-MM-DD HH:mm"
          value-format="YYYY-MM-DD HH:mm"
          style="width:100%"
        />
      </el-form-item>

      <el-form-item label="时长" required>
        <el-select v-model="durationMinutes" placeholder="选择课程时长" style="width:100%">
          <el-option label="45 分钟" :value="45" />
          <el-option label="1 小时" :value="60" />
          <el-option label="1.5 小时" :value="90" />
          <el-option label="2 小时" :value="120" />
        </el-select>
      </el-form-item>

      <el-form-item label="年级" required>
        <el-select v-model="form.grade" placeholder="选择年级" style="width:100%">
          <el-option v-for="g in gradeOptions" :key="g.id" :label="g.name" :value="g.name" />
        </el-select>
      </el-form-item>

      <el-form-item label="单价" required>
        <el-input v-model="form.hourly_fee" type="number" min="0" placeholder="每小时课时费">
          <template #append>元/时</template>
        </el-input>
      </el-form-item>

      <el-form-item label="重复">
        <el-select v-model="form.repeat_type" style="width:100%" @change="onRepeatChange">
          <el-option label="不重复" value="none" />
          <el-option label="每天" value="daily" />
          <el-option label="每个工作日" value="weekdays" />
          <el-option :label="`每周（${todayWeekdayLabel}）`" value="weekly" />
          <el-option :label="`每两周（${todayWeekdayLabel}）`" value="biweekly" />
          <el-option :label="`每月${todayDayOfMonth}日`" value="monthly" />
          <el-option label="自定义" value="custom" />
        </el-select>
      </el-form-item>

      <!-- 频率：仅「自定义」显示 -->
      <el-form-item v-if="form.repeat_type === 'custom'" label="频率">
        <el-select v-model="form.repeat_interval" style="width:120px">
          <el-option v-for="n in 12" :key="n" :label="'每 ' + n" :value="n" />
        </el-select>
        <el-select v-model="repeatUnit" style="width:120px;margin-left:8px" @change="onUnitChange">
          <el-option label="天" value="day" />
          <el-option label="周" value="week" />
          <el-option label="月" value="month" />
        </el-select>
      </el-form-item>

      <!-- 自定义 + 周：日期（发生于 周几多选，按钮组） -->
      <el-form-item v-if="form.repeat_type === 'custom' && repeatUnit === 'week'" label="日期">
        <el-checkbox-group v-model="weekdaySelected" class="weekday-btn-group">
          <el-checkbox-button v-for="(w, i) in weekdayNames" :key="i" :value="i">{{ w }}</el-checkbox-button>
        </el-checkbox-group>
      </el-form-item>

      <!-- 自定义 + 月：日期选择框 1-31 多选（按钮网格） -->
      <el-form-item v-if="form.repeat_type === 'custom' && repeatUnit === 'month'" label="日期">
        <div class="month-day-box">
          <el-checkbox-group v-model="monthDaysSelected" class="month-day-grid">
            <el-checkbox-button v-for="d in 31" :key="d" :value="d">{{ d }}</el-checkbox-button>
          </el-checkbox-group>
          <div class="month-day-hint">可多选（如 1、5、7），某月无此日期则跳过</div>
        </div>
      </el-form-item>

      <!-- 重复类型：结束（按日期 / 不结束） -->
      <el-form-item v-if="form.repeat_type !== 'none'" label="结束">
        <div style="display:flex;align-items:center;width:100%;gap:8px">
          <el-radio-group v-model="endMode" style="white-space:nowrap">
            <el-radio value="date">按日期</el-radio>
            <el-radio value="never">不结束（52周）</el-radio>
          </el-radio-group>
          <el-date-picker v-if="endMode === 'date'" v-model="form.end_date" type="date" placeholder="选择截止日期" format="YYYY-MM-DD" value-format="YYYY-MM-DD" style="width:160px" />
        </div>
      </el-form-item>

      <el-form-item label="备注">
        <el-input v-model="form.description" type="textarea" :rows="2" placeholder="可选备注信息" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSubmit">添加</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { getStudents, getStudentRecentFee, createCourse, getTeachers } from '../api/index.js'

const props = defineProps({
  modelValue: Boolean
})
const emit = defineEmits(['update:modelValue', 'success'])

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const teacherInfo = JSON.parse(localStorage.getItem('teacher') || '{}')
const teacherRole = teacherInfo.role || 'teacher'
const isSuperAdmin = teacherRole === 'super_admin'
const canSelectTeacher = isSuperAdmin || teacherRole === 'manager'

const gradeOptions = [
  { id: 1, name: '一年级' }, { id: 2, name: '二年级' }, { id: 3, name: '三年级' },
  { id: 4, name: '四年级' }, { id: 5, name: '五年级' }, { id: 6, name: '六年级' },
  { id: 7, name: '初一' }, { id: 8, name: '初二' }, { id: 9, name: '初三' },
  { id: 10, name: '高一' }, { id: 11, name: '高二' }, { id: 12, name: '高三' }
]
const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const form = reactive({
  student_name: '',
  student_id: null,
  manager_id: '',
  teacher_id: '',
  grade: '',
  hourly_fee: '',
  repeat_type: 'none',
  repeat_interval: 1,
  repeat_unit: 'week',
  repeat_weekdays: '',
  repeat_day_of_month: 1,
  end_date: '',
  description: ''
})

const startDateTime = ref(null)
const durationMinutes = ref(60)
const repeatUnit = ref('week')
const endMode = ref('never')
// 周几多选用下标 0=周一 .. 6=周日
const weekdaySelected = ref([])
// 每月日期多选用日号 1..31
const monthDaysSelected = ref([])
const saving = ref(false)
const managerOptions = ref([])
const teacherOptions = ref([])

// 仅自定义+周 需要用户选周几
const showWeekdays = computed(() => {
  return form.repeat_type === 'custom' && repeatUnit.value === 'week'
})

// 开始日期字符串（未选时间时用今天）
const startDateStr = computed(() => startDateTime.value?.substring(0, 10) || dayjs().format('YYYY-MM-DD'))

// 重复选项标签里的周几 / 日（按开始日期当天）
const todayWeekdayLabel = computed(() => {
  const dow = dayjs(startDateStr.value).day() // 0=Sun
  return weekdayNames[dow === 0 ? 6 : dow - 1]
})
const todayDayOfMonth = computed(() => dayjs(startDateStr.value).date())

function getTeacherLabel(t) {
  if (isSuperAdmin) {
    if (t.role === 'manager') return t.name + '（管理员）'
    if (t.manager_name) return t.name + '（' + t.manager_name + '）'
  }
  return t.name
}

async function queryStudents(query, cb) {
  if (!query) return cb([])
  try {
    const res = await getStudents({ name: query })
    cb(res.data.data || [])
  } catch { cb([]) }
}

async function onStudentSelect(student) {
  form.student_id = student.id
  if (!form.grade && student.grade) form.grade = student.grade
  try {
    const res = await getStudentRecentFee(student.id)
    if (res.data.data?.hourly_fee) form.hourly_fee = res.data.data.hourly_fee
  } catch {}
}

async function loadManagerOptions() {
  if (!isSuperAdmin) return
  try {
    const res = await getTeachers()
    managerOptions.value = (res.data.data || []).filter(t => t.role === 'manager')
  } catch {}
}

function onMgrChange(val) {
  form.teacher_id = ''
  loadTeacherOptions(val || undefined)
}

async function loadTeacherOptions(managedBy) {
  try {
    const params = {}
    if (managedBy) params.managed_by = managedBy
    const res = await getTeachers(params)
    teacherOptions.value = (res.data.data || []).filter(t => t.role === 'teacher' || t.role === 'manager')
  } catch {}
}

function onRepeatChange() {
  // 默认选中开始日期对应的周几 / 每月日期（未选时间时用今天）
  const startDay = dayjs(startDateStr.value)
  const dow = startDay.day() // 0=Sun
  const dowIdx = dow === 0 ? 6 : dow - 1
  weekdaySelected.value = [dowIdx]
  monthDaysSelected.value = [startDay.date()]
  // 每月类型的默认日号 = 开始日期当天
  form.repeat_day_of_month = startDay.date()
  // 默认间隔
  if (form.repeat_type === 'none') {
    return
  }
  if (form.repeat_type === 'biweekly') {
    form.repeat_interval = 2
    repeatUnit.value = 'week'
  } else {
    form.repeat_interval = 1
    if (form.repeat_type === 'daily' || form.repeat_type === 'weekdays') repeatUnit.value = 'day'
    else if (form.repeat_type === 'monthly') repeatUnit.value = 'month'
    else if (form.repeat_type === 'custom') repeatUnit.value = 'day' // 自定义默认按天
    else repeatUnit.value = 'week'
  }
}

function onUnitChange() {
  // 切换自定义单位时：若当前没有选中任何月日期，默认补上开始日所在日
  if (form.repeat_type === 'custom' && repeatUnit.value === 'month' && monthDaysSelected.value.length === 0) {
    monthDaysSelected.value = [dayjs(startDateStr.value).date()]
  }
}

watch(visible, v => {
  if (v) {
    loadManagerOptions()
    loadTeacherOptions()
    // 默认开始时间：当前小时的下一个整点，时长1小时
    const now = dayjs()
    const start = now.add(1, 'hour').startOf('hour')
    startDateTime.value = start.format('YYYY-MM-DD HH:mm')
    durationMinutes.value = 60
    onRepeatChange()
  }
})

function resetForm() {
  Object.assign(form, {
    student_name: '', student_id: null, manager_id: '', teacher_id: '',
    grade: '', hourly_fee: '', repeat_type: 'none', repeat_interval: 1,
    repeat_unit: 'week', repeat_weekdays: '', repeat_day_of_month: 1,
    end_date: '', description: ''
  })
  startDateTime.value = null
  durationMinutes.value = 60
  endMode.value = 'never'
  weekdaySelected.value = []
  monthDaysSelected.value = []
  saving.value = false
}

async function handleSubmit() {
  if (!form.student_name.trim()) { ElMessage.warning('请输入学生姓名'); return }
  if (canSelectTeacher && !form.teacher_id) { ElMessage.warning('请选择教师'); return }
  if (!form.grade.trim()) { ElMessage.warning('请输入年级'); return }
  if (!form.hourly_fee || parseFloat(form.hourly_fee) <= 0) { ElMessage.warning('请输入有效的课时费'); return }
  if (!startDateTime.value) { ElMessage.warning('请选择开始时间'); return }
  if (!durationMinutes.value) { ElMessage.warning('请选择时长'); return }
  if (form.repeat_type !== 'none' && endMode.value === 'date' && !form.end_date) {
    ElMessage.warning('已选择「按日期」结束，请选择截止日期')
    return
  }

  const start = dayjs(startDateTime.value)
  const end = start.add(durationMinutes.value, 'minute')

  // 组装周几
  let repeat_weekdays = ''
  if (form.repeat_type === 'weekly' || form.repeat_type === 'biweekly') {
    // 每周/每两周：预设为开始日期当天的周几（周一=1..周日=7）
    const dow = start.day()
    repeat_weekdays = String(dow === 0 ? 7 : dow)
  } else if (showWeekdays.value) {
    // 自定义+周：用户勾选周几（下标 0=周一）
    const selected = weekdaySelected.value.map(i => i + 1).sort((a, b) => a - b)
    if (selected.length === 0) { ElMessage.warning('请至少选择一个重复星期'); return }
    repeat_weekdays = selected.join(',')
  }

  // 组装每月日期（自定义按月 1-31 多选）
  let repeat_day_of_month = form.repeat_day_of_month
  if (form.repeat_type === 'custom' && repeatUnit.value === 'month') {
    const selected = [...monthDaysSelected.value].sort((a, b) => a - b)
    if (selected.length === 0) { ElMessage.warning('请至少选择一个每月日期'); return }
    repeat_day_of_month = selected.join(',')
  }

  // 结束日期：统一「按日期 / 不结束」
  const end_date = endMode.value === 'date' && form.end_date ? form.end_date : undefined

  const data = {
    student_name: form.student_name.trim(),
    student_id: form.student_id || null,
    teacher_id: form.teacher_id || undefined,
    date: start.format('YYYY-MM-DD'),
    start_time: start.format('HH:mm'),
    end_time: end.format('HH:mm'),
    grade: form.grade,
    hourly_fee: parseFloat(form.hourly_fee),
    description: form.description || '',
    repeat_type: form.repeat_type || 'none',
    end_date
  }

  if (form.repeat_type !== 'none') {
    data.repeat_interval = form.repeat_interval
    data.repeat_unit = repeatUnit.value
    data.repeat_weekdays = repeat_weekdays
    data.repeat_day_of_month = repeat_day_of_month
  }

  saving.value = true
  try {
    await createCourse(data)
    ElMessage.success('课程已添加')
    visible.value = false
    emit('success')
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '添加失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/* 周几按钮组：7 个一排 */
.weekday-btn-group {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  width: 100%;
}
.weekday-btn-group :deep(.el-checkbox-button) {
  width: 100%;
}
.weekday-btn-group :deep(.el-checkbox-button__inner) {
  width: 100%;
  padding: 6px 0;
  text-align: center;
}

/* 每月日期按钮：7 列网格 */
.month-day-box {
  width: 100%;
}
.month-day-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  width: 100%;
}
.month-day-grid :deep(.el-checkbox-button) {
  width: 100%;
}
.month-day-grid :deep(.el-checkbox-button__inner) {
  width: 100%;
  padding: 6px 0;
  text-align: center;
}
.month-day-hint {
  color: #909399;
  font-size: 12px;
  margin-top: 6px;
}
</style>
