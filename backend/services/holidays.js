// ===== 辅助函数：节假日数据缓存（用于工作日重复跳过假期） =====
const holidayCache = {};
// 启动时预加载当年节假日
async function preloadHolidays() {
  const years = [new Date().getFullYear(), new Date().getFullYear() + 1];
  for (const year of years) {
    try {
      const response = await fetch(`https://timor.tech/api/holiday/year/${year}`, { signal: AbortSignal.timeout(5000) });
      const data = await response.json();
      if (data.code === 0 && data.holiday) {
        holidayCache[year] = data.holiday;
      }
    } catch (e) {
      console.log(`📅 无法获取 ${year} 年节假日数据，将按标准周末判断`);
    }
  }
  console.log(`📅 已加载 ${Object.keys(holidayCache).length} 年节假日数据`);
}
function isWorkdayOrHoliday(dateStr) {
  const year = dateStr.substring(0, 4);
  const holidays = holidayCache[year];
  if (!holidays) return 'normal'; // 无数据 → 正常按周末判断
  const mmdd = dateStr.substring(5);
  const info = holidays[mmdd];
  if (!info) return 'normal';
  if (info.holiday === true) return 'holiday';       // 放假
  if (info.holiday === false) return 'workday';       // 调休补班
  return 'normal';
}

module.exports = { holidayCache, preloadHolidays, isWorkdayOrHoliday };
