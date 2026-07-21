<template>
  <div class="students-page">
    <header class="students-header">
      <div class="students-header-top">
        <h1 class="students-title">👤 学生管理</h1>
      </div>
      <div class="students-toolbar">
        <el-form :inline="true" size="small" @submit.prevent="doSearch" style="flex:1">
          <el-form-item>
            <el-input v-model="searchName" placeholder="搜索学生姓名" clearable style="width:200px" @keyup.enter="doSearch" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="doSearch">搜索</el-button>
            <el-button @click="resetSearch">重置</el-button>
          </el-form-item>
          <el-form-item style="float:right; margin-right:0">
            <el-button type="primary" size="small" @click="openAddDialog">+ 添加学生</el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="students-count">
        <span>共 {{ total }} 位学生</span>
      </div>
    </header>

    <div class="students-table-wrapper">
      <el-table :data="students" stripe style="width:100%" v-loading="loading" empty-text="暂无学生数据，点击上方「添加学生」开始">
        <el-table-column prop="name" label="姓名" min-width="90" />
        <el-table-column prop="grade" label="年级" min-width="80" />
        <el-table-column label="课时单价" min-width="100">
          <template #default="{ row }">
            ¥{{ (row.hourly_fee || 0).toFixed(0) }}/时
          </template>
        </el-table-column>
        <el-table-column label="缴费模式" min-width="90">
          <template #default="{ row }">
            <el-tag :type="row.payment_mode === 'prepaid' ? 'primary' : 'info'" size="small">
              {{ row.payment_mode === 'prepaid' ? '预交' : '结算' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="预交余额" min-width="110">
          <template #default="{ row }">
            <span v-if="row.payment_mode === 'prepaid'">
              <span :class="(row.prepaid_balance || 0) <= 0 ? 'balance-empty' : 'balance-ok'">
                ¥{{ (row.prepaid_balance || 0).toFixed(0) }}
              </span>
              <el-tag v-if="row._failed_count > 0" type="danger" size="small" style="margin-left:4px">⚠️待补交</el-tag>
            </span>
            <span v-else class="balance-na">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="230">
          <template #default="{ row }">
            <el-button v-if="row.payment_mode === 'prepaid'" type="success" size="small" plain @click="openRechargeDialog(row)">充值</el-button>
            <el-button v-if="row.payment_mode === 'prepaid'" size="small" @click="openTransactionsDialog(row)">流水</el-button>
            <el-button size="small" @click="openEditDialog(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="students-pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          size="small"
          background
          @size-change="onPageSizeChange"
          @current-change="onPageChange"
        />
      </div>
    </div>

    <!-- 添加/编辑学生弹窗 -->
    <el-dialog
      v-model="formDialogVisible"
      :title="isEditing ? '编辑学生' : '添加学生'"
      width="420px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px" size="large">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="学生姓名" />
        </el-form-item>
        <el-form-item label="年级">
          <el-select v-model="form.grade" placeholder="选择年级" style="width:100%">
            <el-option v-for="g in gradeOptions" :key="g.id" :label="g.name" :value="g.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="课时单价">
          <el-input v-model="form.hourly_fee" type="number" min="0" placeholder="每小时的课时费">
            <template #append>元/时</template>
          </el-input>
        </el-form-item>
        <el-form-item label="缴费模式">
          <el-radio-group v-model="form.payment_mode">
            <el-radio value="settle">课后结算</el-radio>
            <el-radio value="prepaid">预交费</el-radio>
          </el-radio-group>
          <div v-if="form.payment_mode === 'prepaid'" class="payment-mode-hint">
            ⚡ 开启后，该学生签到上课时将自动从预交余额扣费
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="formSaving" @click="saveForm">保存</el-button>
      </template>
    </el-dialog>

    <!-- 充值弹窗 -->
    <el-dialog
      v-model="rechargeDialogVisible"
      title="充值"
      width="400px"
      destroy-on-close
    >
      <div class="recharge-info">
        <div class="recharge-student">{{ rechargeTarget?.name }}</div>
        <div class="recharge-balance">当前余额：¥{{ ((rechargeTarget?.prepaid_balance) || 0).toFixed(0) }}</div>
      </div>
      <el-form ref="rechargeFormRef" :model="rechargeForm" :rules="rechargeRules" label-width="80px">
        <el-form-item label="充值金额" prop="amount">
          <el-input v-model.number="rechargeForm.amount" type="number" min="1" placeholder="输入金额">
            <template #append>元</template>
          </el-input>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="rechargeForm.note" placeholder="如：家长交费" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rechargeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="recharging" @click="doRecharge">充值</el-button>
      </template>
    </el-dialog>

    <!-- 流水查看弹窗 -->
    <el-dialog
      v-model="transactionsDialogVisible"
      :title="'预交流水 — ' + (transactionsTarget?.name || '')"
      width="550px"
      destroy-on-close
    >
      <div v-if="transactionsLoading" style="text-align:center;padding:20px">加载中...</div>
      <template v-else>
        <div class="tx-balance">当前余额：<strong>¥{{ (transactionsData.balance || 0).toFixed(0) }}</strong></div>
        <el-table :data="transactionsData.transactions || []" size="small" style="width:100%" empty-text="暂无流水记录">
          <el-table-column label="时间" min-width="140">
            <template #default="{ row }">
              {{ dayjs(row.created_at).format('MM-DD HH:mm') }}
            </template>
          </el-table-column>
          <el-table-column label="类型" min-width="80">
            <template #default="{ row }">
              <el-tag :type="txTypeTag(row.type)" size="small">{{ txTypeLabel(row.type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="金额" min-width="80" align="right">
            <template #default="{ row }">
              <span :class="row.amount > 0 ? 'tx-positive' : 'tx-negative'">
                {{ row.amount > 0 ? '+' : '' }}{{ row.amount.toFixed(0) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="余额" min-width="70" align="right">
            <template #default="{ row }">
              {{ (row.balance_after || 0).toFixed(0) }}
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="140">
            <template #default="{ row }">
              <span style="font-size:12px;color:#909399">{{ row.note || '—' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-dialog>

    <!-- 充值成功提示 -->
    <el-dialog v-model="rechargeResultVisible" title="充值结果" width="380px" destroy-on-close>
      <div class="recharge-result">
        <div class="recharge-result-icon">✅</div>
        <div class="recharge-result-text">充值成功！</div>
        <div class="recharge-result-detail">
          <div>当前余额：¥{{ rechargeResult.balance.toFixed(0) }}</div>
          <div v-if="rechargeResult.auto_deducted > 0">已自动补扣 {{ rechargeResult.auto_deducted }} 笔</div>
          <div v-if="rechargeResult.remaining_failed > 0" style="color:#e74c3c">仍有 {{ rechargeResult.remaining_failed }} 笔待补交</div>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="rechargeResultVisible = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { getStudents, createStudent, updateStudent, rechargeStudent, getStudentTransactions } from '../api/index.js'

const gradeOptions = [
  { id: 1, name: '一年级' }, { id: 2, name: '二年级' }, { id: 3, name: '三年级' },
  { id: 4, name: '四年级' }, { id: 5, name: '五年级' }, { id: 6, name: '六年级' },
  { id: 7, name: '初一' }, { id: 8, name: '初二' }, { id: 9, name: '初三' },
  { id: 10, name: '高一' }, { id: 11, name: '高二' }, { id: 12, name: '高三' }
]

const students = ref([])
const loading = ref(false)
const searchName = ref('')
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

// 列表
async function loadStudents() {
  loading.value = true
  try {
    const params = { page: currentPage.value, page_size: pageSize.value }
    if (searchName.value) params.name = searchName.value
    const res = await getStudents(params)
    students.value = (res.data.data || []).map(s => ({ ...s, hourly_fee: s.hourly_fee || 0, prepaid_balance: s.prepaid_balance || 0 }))
    total.value = res.data.total || 0
  } catch (err) {
    ElMessage.error('加载学生列表失败')
  } finally {
    loading.value = false
  }
}

function doSearch() { currentPage.value = 1; loadStudents() }
function resetSearch() { searchName.value = ''; currentPage.value = 1; loadStudents() }
function onPageChange(page) { currentPage.value = page; loadStudents() }
function onPageSizeChange() { currentPage.value = 1; loadStudents() }

// 添加/编辑弹窗
const formDialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref(null)
const formRef = ref(null)
const formSaving = ref(false)
const form = reactive({
  name: '',
  grade: '',
  hourly_fee: '',
  payment_mode: 'settle'
})

const formRules = {
  name: [{ required: true, message: '请输入学生姓名', trigger: 'blur' }]
}

function resetForm() {
  form.name = ''
  form.grade = ''
  form.hourly_fee = ''
  form.payment_mode = 'settle'
  isEditing.value = false
  editingId.value = null
  formSaving.value = false
}

function openAddDialog() {
  resetForm()
  formDialogVisible.value = true
}

function openEditDialog(row) {
  isEditing.value = true
  editingId.value = row.id
  form.name = row.name
  form.grade = row.grade || ''
  form.hourly_fee = row.hourly_fee || ''
  form.payment_mode = row.payment_mode || 'settle'
  formDialogVisible.value = true
}

async function saveForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  formSaving.value = true
  try {
    const data = {
      name: form.name.trim(),
      grade: form.grade,
      hourly_fee: parseFloat(form.hourly_fee) || 0,
      payment_mode: form.payment_mode
    }
    if (isEditing.value) {
      await updateStudent(editingId.value, data)
      ElMessage.success('学生已更新')
    } else {
      await createStudent(data)
      ElMessage.success('学生已添加')
    }
    formDialogVisible.value = false
    loadStudents()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '保存失败')
  } finally {
    formSaving.value = false
  }
}

// 充值
const rechargeDialogVisible = ref(false)
const rechargeTarget = ref(null)
const rechargeFormRef = ref(null)
const rechargeForm = reactive({ amount: '', note: '' })
const recharging = ref(false)
const rechargeRules = {
  amount: [{ required: true, type: 'number', min: 1, message: '请输入充值金额', trigger: 'blur' }]
}

function openRechargeDialog(row) {
  rechargeTarget.value = row
  rechargeForm.amount = ''
  rechargeForm.note = ''
  rechargeDialogVisible.value = true
}

const rechargeResultVisible = ref(false)
const rechargeResult = reactive({ balance: 0, auto_deducted: 0, remaining_failed: 0 })

async function doRecharge() {
  const valid = await rechargeFormRef.value?.validate().catch(() => false)
  if (!valid) return
  recharging.value = true
  try {
    const res = await rechargeStudent(rechargeTarget.value.id, {
      amount: parseFloat(rechargeForm.amount),
      note: rechargeForm.note || `充值 ¥${parseFloat(rechargeForm.amount).toFixed(0)}`
    })
    const data = res.data.data
    rechargeResult.balance = data.balance
    rechargeResult.auto_deducted = data.auto_deducted
    rechargeResult.remaining_failed = data.remaining_failed
    rechargeDialogVisible.value = false
    rechargeResultVisible.value = true
    loadStudents()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '充值失败')
  } finally {
    recharging.value = false
  }
}

// 流水
const transactionsDialogVisible = ref(false)
const transactionsTarget = ref(null)
const transactionsData = reactive({ balance: 0, transactions: [] })
const transactionsLoading = ref(false)

async function openTransactionsDialog(row) {
  transactionsTarget.value = row
  transactionsData.balance = 0
  transactionsData.transactions = []
  transactionsDialogVisible.value = true
  transactionsLoading.value = true
  try {
    const res = await getStudentTransactions(row.id)
    transactionsData.balance = res.data.data.balance || 0
    transactionsData.transactions = res.data.data.transactions || []
  } catch (err) {
    ElMessage.error('加载流水失败')
  } finally {
    transactionsLoading.value = false
  }
}

function txTypeTag(type) {
  const map = { recharge: 'success', deduct: '', deduct_failed: 'danger', refund: 'warning' }
  return map[type] || 'info'
}
function txTypeLabel(type) {
  const map = { recharge: '充值', deduct: '扣费', deduct_failed: '待补交', refund: '退款' }
  return map[type] || type
}

onMounted(() => { loadStudents() })
</script>

<style scoped>
@import "../assets/css/students.css";
</style>
