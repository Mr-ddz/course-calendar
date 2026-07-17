/**
 * 2026年节假日数据 + 动态获取
 * 优先从后端 API 获取，获取失败使用内置数据兜底
 */

// 内置静态数据（兜底用）
const fallbackHolidays = {
  // ===== 元旦 1月1日-3日，1月4日（周日）上班 =====
  '2026-01-01': { type: 'holiday', name: '元旦（休）' },
  '2026-01-02': { type: 'holiday', name: '元旦（休）' },
  '2026-01-03': { type: 'holiday', name: '元旦（休）' },
  '2026-01-04': { type: 'workday', name: '元旦（班）' },
  // ===== 春节 2月15日-23日，2月14日（周六）、2月28日（周六）上班 =====
  '2026-02-14': { type: 'workday', name: '春节（班）' },
  '2026-02-15': { type: 'holiday', name: '春节（休）' },
  '2026-02-16': { type: 'holiday', name: '春节（休）' },
  '2026-02-17': { type: 'holiday', name: '春节（休）' },
  '2026-02-18': { type: 'holiday', name: '春节（休）' },
  '2026-02-19': { type: 'holiday', name: '春节（休）' },
  '2026-02-20': { type: 'holiday', name: '春节（休）' },
  '2026-02-21': { type: 'holiday', name: '春节（休）' },
  '2026-02-22': { type: 'holiday', name: '春节（休）' },
  '2026-02-23': { type: 'holiday', name: '春节（休）' },
  '2026-02-28': { type: 'workday', name: '春节（班）' },
  // ===== 清明节 4月4日-6日 =====
  '2026-04-04': { type: 'holiday', name: '清明（休）' },
  '2026-04-05': { type: 'holiday', name: '清明（休）' },
  '2026-04-06': { type: 'holiday', name: '清明（休）' },
  // ===== 劳动节 5月1日-5日，5月9日（周六）上班 =====
  '2026-05-01': { type: 'holiday', name: '劳动（休）' },
  '2026-05-02': { type: 'holiday', name: '劳动（休）' },
  '2026-05-03': { type: 'holiday', name: '劳动（休）' },
  '2026-05-04': { type: 'holiday', name: '劳动（休）' },
  '2026-05-05': { type: 'holiday', name: '劳动（休）' },
  '2026-05-09': { type: 'workday', name: '劳动（班）' },
  // ===== 端午节 6月19日-21日 =====
  '2026-06-19': { type: 'holiday', name: '端午（休）' },
  '2026-06-20': { type: 'holiday', name: '端午（休）' },
  '2026-06-21': { type: 'holiday', name: '端午（休）' },
  // ===== 中秋节 9月25日-27日 =====
  '2026-09-25': { type: 'holiday', name: '中秋（休）' },
  '2026-09-26': { type: 'holiday', name: '中秋（休）' },
  '2026-09-27': { type: 'holiday', name: '中秋（休）' },
  // ===== 国庆节 10月1日-7日，9月20日（周日）、10月10日（周六）上班 =====
  '2026-09-20': { type: 'workday', name: '国庆（班）' },
  '2026-10-01': { type: 'holiday', name: '国庆（休）' },
  '2026-10-02': { type: 'holiday', name: '国庆（休）' },
  '2026-10-03': { type: 'holiday', name: '国庆（休）' },
  '2026-10-04': { type: 'holiday', name: '国庆（休）' },
  '2026-10-05': { type: 'holiday', name: '国庆（休）' },
  '2026-10-06': { type: 'holiday', name: '国庆（休）' },
  '2026-10-07': { type: 'holiday', name: '国庆（休）' },
  '2026-10-10': { type: 'workday', name: '国庆（班）' },
}

// 运行时数据（初始化时复制内置数据，API 成功时替换）
let holidayData = { ...fallbackHolidays }
let loaded = false

/**
 * 从后端 API 获取节假日数据
 * @param {number} year - 年份
 */
export async function loadHolidays(year) {
  // 如果已经加载过当年数据，不再重复请求
  if (loaded) return
  loaded = true

  try {
    const res = await fetch(`/api/holidays/${year}`)
    const result = await res.json()

    if (result.code === 0 && result.holiday) {
      // 转换 API 数据为内部格式（API 返回的 key 是 MM-DD，需要补全年份）
      const apiData = {}
      for (const [mmdd, info] of Object.entries(result.holiday)) {
        const dateStr = year + '-' + mmdd
        // 放假去"节"，补班用 target 字段（"国庆节后补班" → "国庆"）
        let baseName
        if (info.holiday) {
          baseName = info.name === '春节' ? '春节' : info.name.replace(/节$/, '')
        } else if (info.target) {
          baseName = info.target.replace(/节$/, '')
          baseName = baseName === '春' ? '春节' : baseName
          // 国务院安排：9月20日（周日）为国庆节补班
          if (dateStr === '2026-09-20') baseName = '国庆'
        } else {
          baseName = info.name.replace(/节$/, '')
        }
        const suffix = info.holiday === true ? '（休）' : '（班）'
        apiData[dateStr] = { type: info.holiday === true ? 'holiday' : 'workday', name: baseName + suffix }
      }
      if (Object.keys(apiData).length > 0) {
        holidayData = apiData
        console.log(`📅 已加载 ${year} 年节假日数据（共 ${Object.keys(apiData).length} 天）`)
      }
    }
  } catch (err) {
    console.warn('获取节假日数据失败，使用内置数据:', err.message)
  }
}

/**
 * 获取某一天的节假日信息
 * @param {string} dateStr - 'YYYY-MM-DD' 格式
 * @returns {{ type: string, name: string } | null}
 */
export function getHoliday(dateStr) {
  return holidayData[dateStr] || null
}

export default holidayData
