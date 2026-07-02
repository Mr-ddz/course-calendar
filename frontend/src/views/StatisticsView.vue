<template>
  <div class="stats-page">
    <!-- 顶部导航 -->
    <header class="stats-header">
      <div class="stats-header-top">
        <h1 class="stats-title">📊 统计</h1>
        <div class="stats-user">
          <span class="stats-user-name">{{ teacherName }}</span>
          <el-button size="small" class="stats-logout-btn" @click="handleLogout">退出</el-button>
        </div>
      </div>
      <div class="cal-tabs" style="margin-bottom: 8px; display: flex; gap: 6px;">
        <el-button size="small" @click="$router.push('/')">📅 月历</el-button>
        <el-button size="small" type="primary" @click="$router.push('/statistics')">📊 统计</el-button>
      </div>

      <!-- 统计周期切换 -->
      <div class="stats-period">
        <el-radio-group v-model="period" size="small" @change="loadStatistics">
          <el-radio-button value="week">本周</el-radio-button>
          <el-radio-button value="month">本月</el-radio-button>
          <el-radio-button value="year">本年</el-radio-button>
          <el-radio-button value="custom">自定义</el-radio-button>
        </el-radio-group>
        <template v-if="period === 'custom'">
          <el-date-picker
            v-model="customDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            size="small"
            style="width: 240px; margin-left: 8px;"
            @change="loadStatistics"
          />
        </template>
      </div>

      <!-- 统计概览卡片 -->
      <div class="stats-cards">
        <div class="stat-card">
          <div class="stat-card-value">{{ statsData.totals?.total_courses || 0 }}</div>
          <div class="stat-card-label">总课程数</div>
        </div>
        <div class="stat-card stat-card--primary">
          <div class="stat-card-value">{{ formatHours(statsData.totals?.total_hours) }}</div>
          <div class="stat-card-label">上课时长</div>
        </div>
        <div class="stat-card stat-card--success">
          <div class="stat-card-value">¥{{ (statsData.totals?.total_attended_fee || 0).toFixed(0) }}</div>
          <div class="stat-card-label">实收课时费</div>
        </div>
        <div class="stat-card stat-card--warning">
          <div class="stat-card-value">¥{{ (statsData.totals?.total_fee || 0).toFixed(0) }}</div>
          <div class="stat-card-label">总课时费</div>
        </div>
      </div>

      <!-- 分周期明细 -->
      <div class="stats-chart" v-if="statsData.data?.length">
        <el-table :data="statsData.data" size="small" stripe>
          <el-table-column prop="period" label="周期" width="120" />
          <el-table-column prop="course_count" label="课程数" width="80" />
          <el-table-column label="上课时长">
            <template #default="{ row }">
              {{ formatHours(row.total_hours) }}
            </template>
          </el-table-column>
          <el-table-column label="课时费">
            <template #default="{ row }">
              ¥{{ (row.total_fee || 0).toFixed(0) }}
            </template>
          </el-table-column>
          <el-table-column label="实收">
            <template #default="{ row }">
              <span class="fee-attended">¥{{ (row.attended_fee || 0).toFixed(0) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </header>

    <!-- 搜索筛选 -->
    <div class="stats-search">
      <el-form :inline="true" size="small" @submit.prevent="doSearch">
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="searchDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="YYYY-MM-DD"
            style="width: 220px;"
            clearable
            @change="doSearch"
          />
        </el-form-item>
        <el-form-item label="学生姓名">
          <el-input v-model="searchForm.student_name" placeholder="模糊搜索" clearable @clear="doSearch" style="width: 130px;" />
        </el-form-item>
        <el-form-item label="年级">
          <el-select v-model="searchForm.grade" placeholder="全部" clearable @change="doSearch" style="width: 130px;">
            <el-option label="全部" value="" />
            <el-option v-for="g in gradeOptions" :key="g.id" :label="g.name" :value="g.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="签到">
          <el-select v-model="searchForm.attended" placeholder="全部" clearable @change="doSearch" style="width: 100px;">
            <el-option label="全部" value="" />
            <el-option label="已到课" :value="1" />
            <el-option label="未到课" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="doSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 搜索结果表格 -->
    <div class="stats-table-wrapper">
      <el-table :data="searchResult.data" stripe style="width: 100%" v-loading="searchLoading">
        <el-table-column prop="date" label="日期" width="110" />
        <el-table-column prop="start_time" label="开始" width="70" />
        <el-table-column prop="end_time" label="结束" width="70" />
        <el-table-column label="时长" width="70">
          <template #default="{ row }">
            {{ calcDuration(row.start_time, row.end_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="student_name" label="学生" min-width="90" />
        <el-table-column prop="grade" label="年级" width="120" />
        <el-table-column label="课时费" width="80">
          <template #default="{ row }">
            ¥{{ row.hourly_fee }}
          </template>
        </el-table-column>
        <el-table-column label="实收" width="80">
          <template #default="{ row }">
            <span :class="row.attended ? 'fee-yes' : 'fee-no'">
              {{ row.attended ? '¥' + row.hourly_fee : '¥0' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="签到" width="80">
          <template #default="{ row }">
            <el-tag :type="row.attended ? 'success' : 'info'" size="small">
              {{ row.attended ? '已到' : '未到' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="isAdmin" prop="teacher_name" label="教师" width="80" />
      </el-table>

      <!-- 分页 -->
      <div class="stats-pagination">
        <el-pagination
          v-model:current-page="searchPage"
          v-model:page-size="searchPageSize"
          :page-sizes="[10, 50, 100]"
          :total="searchResult.total"
          layout="total, sizes, prev, pager, next"
          small
          @size-change="doSearch"
          @current-change="loadSearch"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import { searchCourses, getStatistics, logout as logoutApi } from '../api/index.js'

const gradeOptions = [
  { id: 1, name: '一年级' }, { id: 2, name: '二年级' }, { id: 3, name: '三年级' },
  { id: 4, name: '四年级' }, { id: 5, name: '五年级' }, { id: 6, name: '六年级' },
  { id: 7, name: '初一' }, { id: 8, name: '初二' }, { id: 9, name: '初三' },
  { id: 10, name: '高一' }, { id: 11, name: '高二' }, { id: 12, name: '高三' }
]

const router = useRouter()

const teacherInfo = JSON.parse(localStorage.getItem('teacher') || '{}')
const teacherName = teacherInfo.name || ''
const isAdmin = teacherInfo.id === 1

// ===== 统计周期 =====
const period = ref('month')
const customDateRange = ref(null)
const statsData = reactive({ data: [], totals: null })

function getDateRange() {
  const now = dayjs()
  if (period.value === 'week') {
    const start = now.startOf('week').format('YYYY-MM-DD')
    const end = now.format('YYYY-MM-DD')
    return { start_date: start, end_date: end }
  } else if (period.value === 'month') {
    const start = now.startOf('month').format('YYYY-MM-DD')
    const end = now.format('YYYY-MM-DD')
    return { start_date: start, end_date: end }
  } else if (period.value === 'year') {
    const start = now.startOf('year').format('YYYY-MM-DD')
    const end = now.format('YYYY-MM-DD')
    return { start_date: start, end_date: end }
  } else if (period.value === 'custom' && customDateRange.value) {
    return { start_date: customDateRange.value[0], end_date: customDateRange.value[1] }
  }
  return {}
}

function getGroupBy() {
  if (period.value === 'week') return 'week'
  if (period.value === 'year') return 'year'
  return 'month'
}

async function loadStatistics() {
  try {
    const params = {
      group_by: getGroupBy(),
      ...getDateRange()
    }
    if (!params.start_date) return
    const res = await getStatistics(params)
    statsData.data = res.data.data || []
    statsData.totals = res.data.totals || {}
  } catch (err) {
    console.error('加载统计失败:', err)
  }
}

// ===== 搜索 =====
const searchDateRange = ref(null)
const searchForm = reactive({
  student_name: '',
  grade: '',
  attended: ''
})
const searchResult = reactive({ data: [], total: 0 })
const searchPage = ref(1)
const searchPageSize = ref(10)
const searchLoading = ref(false)

async function doSearch() {
  searchPage.value = 1
  await loadSearch()
}

function resetSearch() {
  searchForm.student_name = ''
  searchForm.grade = ''
  searchForm.attended = ''
  searchDateRange.value = null
  doSearch()
}

async function loadSearch() {
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

    const res = await searchCourses(params)
    searchResult.data = res.data.data || []
    searchResult.total = res.data.total || 0
  } catch (err) {
    console.error('搜索失败:', err)
  } finally {
    searchLoading.value = false
  }
}

// ===== 辅助函数 =====
function formatHours(hours) {
  if (!hours) return '0h'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

function calcDuration(start, end) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确认退出登录？', '退出', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'info'
    })
    try { await logoutApi() } catch { /* ignore */ }
    localStorage.removeItem('token')
    localStorage.removeItem('teacher')
    router.push('/login')
  } catch { /* cancel */ }
}

onMounted(() => {
  loadStatistics()
  loadSearch()
})
</script>

<style scoped>
@import "../assets/css/statistics.css";
</style>
