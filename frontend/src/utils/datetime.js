import dayjs from 'dayjs'

// 数据库时间统一以 UTC 存储（无时区标记的 'YYYY-MM-DD HH:MM:SS'）。
// 前端展示前补 Z 让 dayjs 按 UTC 解析，再转成本地（北京时间）显示，避免偏 8 小时。
export function fmtUtc(utcStr, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!utcStr) return ''
  return dayjs(String(utcStr).replace(' ', 'T') + 'Z').format(format)
}
