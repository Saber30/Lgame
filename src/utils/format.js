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
