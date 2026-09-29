const CATEGORY = {
  news: { label: '游戏新闻', emoji: '📰' },
  insight: { label: '游戏心得', emoji: '🎮' },
  learn: { label: '学习园地', emoji: '📚' },
  daily: { label: '工作日报', emoji: '📝' },
}

export function categoryLabel(cat) {
  return CATEGORY[cat]?.label || cat
}

export function categoryEmoji(cat) {
  return CATEGORY[cat]?.emoji || ''
}

// SQLite 的 datetime('now') 存的是 UTC 的 "YYYY-MM-DD HH:MM:SS"
function parseTime(sqliteTime) {
  return new Date(String(sqliteTime).replace(' ', 'T') + 'Z')
}

export function timeAgo(sqliteTime) {
  const diff = (Date.now() - parseTime(sqliteTime).getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前'
  if (diff < 86400 * 30) return Math.floor(diff / 86400) + ' 天前'
  return parseTime(sqliteTime).toLocaleDateString('zh-CN')
}

export function fmtTime(sqliteTime) {
  return parseTime(sqliteTime).toLocaleString('zh-CN', { hour12: false })
}

export function fmtDate(sqliteTime) {
  return parseTime(sqliteTime).toLocaleDateString('zh-CN')
}

export function parseDailyMeta(meta) {
  try {
    return JSON.parse(meta || '{}')
  } catch {
    return {}
  }
}

/** 按北京时间取日期分组键（YYYY-MM-DD），和打卡统计口径一致 */
export function beijingDayKey(sqliteTime) {
  const d = parseTime(sqliteTime)
  if (Number.isNaN(d.getTime())) return ''
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

/** 今天的北京时间日期（YYYY-MM-DD） */
export function todayBeijing() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

/** 把 YYYY-MM-DD 显示成「9月22日 周一」 */
export function fmtDayLabel(key) {
  const [y, m, d] = String(key).split('-').map(Number)
  if (!y || !m || !d) return key
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${m}月${d}日 ${week}`
}
