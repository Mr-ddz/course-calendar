<template>
  <div class="stats-page">
    <!-- 顶部导航 -->
    <header class="stats-header">
      <div class="stats-header-top">
        <h1 class="stats-title"><el-icon><DataAnalysis /></el-icon> 统计</h1>
        <div class="stats-user">
          
        </div>
      </div>
      <!-- 统计周期切换 -->
      <div class="stats-period">
        <el-radio-group v-model="period" size="small">
          <el-radio-button value="week">本周</el-radio-button>
          <el-radio-button value="month">本月</el-radio-button>
          <el-radio-button value="year">本年</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 统计概览卡片 -->
      <div class="stats-cards">
        <div class="stat-card">
          <div class="stat-card-value">{{ statsData.totals?.total_courses || 0 }}</div>
          <div class="stat-card-label">总课程数</div>
        </div>
        <div class="stat-card stat-card--done">
          <div class="stat-card-value">{{ statsData.totals?.total_attended_courses || 0 }}</div>
          <div class="stat-card-label">已上课程数</div>
        </div>
        <div class="stat-card stat-card--primary">
          <div class="stat-card-value">{{ formatHours(statsData.totals?.total_hours) }}</div>
          <div class="stat-card-label">应上课时长</div>
        </div>
        <div class="stat-card stat-card--done">
          <div class="stat-card-value">{{ formatHours(statsData.totals?.total_attended_hours) }}</div>
          <div class="stat-card-label">已上课时长</div>
        </div>
        <div class="stat-card stat-card--warning">
          <div class="stat-card-value">¥{{ (statsData.totals?.total_fee || 0).toFixed(0) }}</div>
          <div class="stat-card-label">应收课时费</div>
        </div>
        <div class="stat-card stat-card--success">
          <div class="stat-card-value">¥{{ (statsData.totals?.total_attended_fee || 0).toFixed(0) }}</div>
          <div class="stat-card-label">实收课时费</div>
        </div>
        <div class="stat-card stat-card--info">
          <div class="stat-card-value">¥{{ (statsData.totals?.total_prepaid || 0).toFixed(0) }}</div>
          <div class="stat-card-label">预存余额</div>
        </div>
      </div>
    </header>

    <!-- 搜索筛选 -->
    <div class="stats-search">
      <el-form :inline="true" size="small" @submit.prevent="doSearch">
        <el-form-item label="日期范围" style="margin-bottom: 10px;">
          <el-date-picker
            v-model="searchDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="YYYY-MM-DD"
            style="width: 220px;"
            clearable
            @change="period = ''"
          />
        </el-form-item>
        <el-form-item label="学生" style="margin-bottom: 10px;">
          <el-input v-model="searchForm.student_name" placeholder="模糊搜索" clearable style="width: 130px;" />
        </el-form-item>
        <el-form-item label="年级" style="margin-bottom: 10px;">
          <el-select v-model="searchForm.grade" placeholder="全部" clearable style="width: 130px;">
            <el-option label="全部" value="" />
            <el-option v-for="g in gradeOptions" :key="g.id" :label="g.name" :value="g.name" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="isSuperAdmin" label="管理员" style="margin-bottom: 10px;">
          <el-select v-model="searchForm.manager_id" placeholder="全部管理员" clearable style="width: 150px;" @change="onManagerChange">
            <el-option label="全部管理员" value="" />
            <el-option v-for="m in managerOptions" :key="m.id" :label="m.name" :value="String(m.id)" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="showTeacherFilter" label="教师" style="margin-bottom: 10px;">
          <el-select v-model="searchForm.teacher_id" placeholder="全部教师" clearable style="width: 130px;">
            <el-option label="全部教师" value="" />
            <el-option v-for="t in teacherOptions" :key="t.id" :label="t.name" :value="String(t.id)" />
          </el-select>
        </el-form-item>
        <el-form-item label="签到" style="margin-bottom: 10px;">
          <el-select v-model="searchForm.attended" placeholder="全部" clearable style="width: 100px;">
            <el-option label="全部" value="" />
            <el-option label="已到课" :value="1" />
            <el-option label="未到课" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item style="margin-bottom: 10px;">
          <el-button type="primary" @click="doSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
          <el-button :loading="exporting" @click="exportExcel">📥 导出Excel</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 搜索结果表格 -->
    <div class="stats-table-wrapper">
      <el-table :data="searchResult.data" stripe style="width: 100%" v-loading="searchLoading">
        <el-table-column prop="date" label="日期" min-width="100" />
        <el-table-column prop="start_time" label="开始" min-width="60" />
        <el-table-column prop="end_time" label="结束" min-width="60" />
        <el-table-column label="时长" min-width="70">
          <template #default="{ row }">
            {{ calcDuration(row.start_time, row.end_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="student_name" label="学生" min-width="70" />
        <el-table-column prop="grade" label="年级" min-width="90" />
        <el-table-column label="每小时课时费" min-width="80">
          <template #default="{ row }">
            ¥{{ row.hourly_fee }}
          </template>
        </el-table-column>
        <el-table-column label="实收" min-width="80">
          <template #default="{ row }">
            <span :class="row.attended ? 'fee-yes' : 'fee-no'">
              {{ row.attended ? '¥' + calcReceivedFee(row) : '¥0' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="签到" min-width="70">
          <template #default="{ row }">
            <el-tag :type="row.attended ? 'success' : 'info'" size="small">
              {{ row.attended ? '已到' : '未到' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="showTeacherFilter" prop="teacher_name" label="教师" min-width="70" />
        <el-table-column label="操作" min-width="60">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="goToEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="stats-pagination">
        <el-pagination
          v-model:current-page="searchPage"
          v-model:page-size="searchPageSize"
          :page-sizes="[10, 50, 100]"
          :total="searchResult.total"
          layout="total, sizes, prev, pager, next"
          size="small"
          @size-change="onPageSizeChange"
          @current-change="onPageChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { searchCourses, getStatistics, getTeachers } from '../api/index.js'
import { saveFile } from '../utils/saveFile.js'

const gradeOptions = [
  { id: 1, name: '一年级' }, { id: 2, name: '二年级' }, { id: 3, name: '三年级' },
  { id: 4, name: '四年级' }, { id: 5, name: '五年级' }, { id: 6, name: '六年级' },
  { id: 7, name: '初一' }, { id: 8, name: '初二' }, { id: 9, name: '初三' },
  { id: 10, name: '高一' }, { id: 11, name: '高二' }, { id: 12, name: '高三' }
]

const teacherInfo = JSON.parse(localStorage.getItem('teacher') || '{}')
const teacherName = teacherInfo.name || ''
const teacherRole = teacherInfo.role || 'teacher'
const isSuperAdmin = teacherRole === 'super_admin'
const showTeacherFilter = isSuperAdmin || teacherRole === 'manager'
const teacherOptions = ref([])
const managerOptions = ref([])
const router = useRouter()

async function loadTeacherOptions(managedBy) {
  try {
    const params = {}
    if (managedBy) params.managed_by = managedBy
    const res = await getTeachers(params)
    teacherOptions.value = res.data.data || []
  } catch {}
}

async function loadManagerOptions() {
  if (!isSuperAdmin) return
  try {
    const res = await getTeachers()
    managerOptions.value = (res.data.data || []).filter(t => t.role === 'manager')
  } catch {}
}

function onManagerChange(val) {
  searchForm.teacher_id = ''
  loadTeacherOptions(val || undefined)
}

// ===== 统计周期（只填充日期范围，不直接调接口） =====
const period = ref('month')
const statsData = reactive({ data: [], totals: null })

function getPeriodRange(p) {
  const now = dayjs()
  if (p === 'week') {
    const day = now.day()
    const diff = day === 0 ? 6 : day - 1 // 距离周一的天数
    return [now.subtract(diff, 'day').format('YYYY-MM-DD'), now.format('YYYY-MM-DD')]
  } else if (p === 'year') {
    return [now.startOf('year').format('YYYY-MM-DD'), now.format('YYYY-MM-DD')]
  }
  // 默认本月
  return [now.startOf('month').format('YYYY-MM-DD'), now.format('YYYY-MM-DD')]
}

function getGroupBy(p) {
  if (p === 'week') return 'week'
  if (p === 'year') return 'year'
  return 'month'
}

// 周期切换时：更新日期范围并直接触发搜索（只改日期范围，其它筛选条件不变）
watch(period, (val) => {
  if (!val) return // 用户手动改了日期，不做任何事
  searchDateRange.value = getPeriodRange(val)
  doSearch()
})

// ===== 搜索（统一入口：点击搜索按钮时调用） =====
const searchDateRange = ref(getPeriodRange('month'))
const searchForm = reactive({
  student_name: '',
  grade: '',
  attended: '',
  teacher_id: '',
  manager_id: ''
})
const searchResult = reactive({ data: [], total: 0 })
const searchPage = ref(1)
const searchPageSize = ref(10)
const searchLoading = ref(false)

async function doSearch() {
  searchPage.value = 1

  // 同时加载统计和搜索结果
  const range = searchDateRange.value
  const params = { page: 1, page_size: searchPageSize.value }
  if (range) {
    params.start_date = range[0]
    params.end_date = range[1]
  }
  if (searchForm.student_name) params.student_name = searchForm.student_name
  if (searchForm.grade) params.grade = searchForm.grade
  if (searchForm.attended !== '' && searchForm.attended !== null) {
    params.attended = String(searchForm.attended)
  }
  if (searchForm.teacher_id) params.teacher_id = searchForm.teacher_id
  if (searchForm.manager_id) params.managed_by = searchForm.manager_id

  // 加载统计
  if (range) {
    try {
      const statsParams = {
        group_by: getGroupBy(period.value),
        start_date: range[0],
        end_date: range[1]
      }
      if (searchForm.teacher_id) statsParams.teacher_id = searchForm.teacher_id
      const res = await getStatistics(statsParams)
      statsData.data = res.data.data || []
      statsData.totals = res.data.totals || {}
    } catch (err) {
      console.error('加载统计失败:', err)
    }
  }

  // 加载搜索表格
  searchLoading.value = true
  try {
    const res = await searchCourses(params)
    searchResult.data = res.data.data || []
    searchResult.total = res.data.total || 0
  } catch (err) {
    console.error('搜索失败:', err)
  } finally {
    searchLoading.value = false
  }
}

// 分页切换时只加载表格数据，不重置页码
function onPageChange(page) {
  searchPage.value = page
  loadSearchOnly()
}

// 切换每页条数时重置到第一页
function onPageSizeChange() {
  searchPage.value = 1
  loadSearchOnly()
}

// 只加载搜索表格（不重置页码，不加载统计）
async function loadSearchOnly() {
  searchLoading.value = true
  try {
    const params = {
      page: searchPage.value,
      page_size: searchPageSize.value
    }
    if (searchDateRange.value) {
      params.start_date = searchDateRange.value[0]
      params.end_date = searchDateRange.value[1]
    }
    if (searchForm.student_name) params.student_name = searchForm.student_name
    if (searchForm.grade) params.grade = searchForm.grade
    if (searchForm.attended !== '' && searchForm.attended !== null) {
      params.attended = String(searchForm.attended)
    }
    if (searchForm.teacher_id) params.teacher_id = searchForm.teacher_id
    if (searchForm.manager_id) params.managed_by = searchForm.manager_id
    const res = await searchCourses(params)
    searchResult.data = res.data.data || []
    searchResult.total = res.data.total || 0
  } catch (err) {
    console.error('搜索失败:', err)
  } finally {
    searchLoading.value = false
  }
}

function resetSearch() {
  searchForm.student_name = ''
  searchForm.grade = ''
  searchForm.attended = ''
  searchForm.teacher_id = ''
  period.value = 'month'
  doSearch()
}

// ===== 辅助函数 =====
const exporting = ref(false)

async function exportExcel() {
  if (exporting.value) return
  exporting.value = true
  try {
    const result = await saveFile(`课程数据_${new Date().toISOString().slice(0, 10)}.xlsx`, buildExcel)
    if (result === 'saved') ElMessage.success('导出成功')
    else if (result === 'fallback') ElMessage.success('已开始导出，请留意浏览器下载栏')
    else if (result === 'cancelled') ElMessage.info('已取消导出')
    else if (result === 'no-data') ElMessage.warning('没有数据可导出')
  } catch {
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

async function buildExcel() {
  // 用当前搜索条件请求全部数据（取消分页限制）
  const params = { page: 1, page_size: 100000 }
  if (searchDateRange.value) {
    params.start_date = searchDateRange.value[0]
    params.end_date = searchDateRange.value[1]
  }
  if (searchForm.student_name) params.student_name = searchForm.student_name
  if (searchForm.grade) params.grade = searchForm.grade
  if (searchForm.attended !== "" && searchForm.attended !== null) {
    params.attended = String(searchForm.attended)
  }
  if (searchForm.teacher_id) params.teacher_id = searchForm.teacher_id
  if (searchForm.manager_id) params.managed_by = searchForm.manager_id

  const res = await searchCourses(params)
  const allData = res.data.data || []
  if (!allData || allData.length === 0) return null

  const data = allData.map(r => ({
    '日期': r.date,
    '开始': r.start_time,
    '结束': r.end_time,
    '时长': calcDuration(r.start_time, r.end_time),
    '学生': r.student_name,
    '年级': r.grade || '',
    '每小时课时费': r.hourly_fee,
    '实收': r.attended ? calcReceivedFee(r) : '0',
    '签到': r.attended ? '已到' : '未到',
    '教师': r.teacher_name || ''
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 6 }, { wch: 10 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '课程记录')
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
}

function goToEdit(row) {
  router.push('/app/day/' + row.date + '?edit=' + row.id + '&from=statistics')
}

function formatHours(hours) {
  if (!hours) return '0h'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

function calcReceivedFee(row) {
  const hourly = parseFloat(row.hourly_fee) || 0
  const [sh, sm] = row.start_time.split(':').map(Number)
  const [eh, em] = row.end_time.split(':').map(Number)
  const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60
  return (hourly * hours).toFixed(0)
}

function calcDuration(start, end) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

onMounted(() => {
  searchDateRange.value = getPeriodRange('month')
  loadManagerOptions()
  loadTeacherOptions()
  doSearch()
})

</script>

<style scoped>
@import "../assets/css/statistics.css";
</style>
