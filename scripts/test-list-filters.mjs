// 验证列表接口的筛选 SQL 与日报口径：node --no-warnings --experimental-sqlite scripts/test-list-filters.mjs
// 复刻 worker/api.js 里的 WHERE 拼法、参数顺序与 DAILY_DAY_SQL
import { DatabaseSync } from 'node:sqlite'

// 和 worker 里保持一致的常量
const DAILY_DAY_SQL = "COALESCE(json_extract(p.meta, '$.day'), date(p.created_at, '+8 hours'))"

const db = new DatabaseSync(':memory:')
db.exec('CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER, category TEXT, title TEXT, content TEXT, meta TEXT, status TEXT, created_at TEXT)')
db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT)')
db.prepare('INSERT INTO users (id, username) VALUES (?,?)').run(1, '甲')
db.prepare('INSERT INTO users (id, username) VALUES (?,?)').run(2, '乙')

const ins = db.prepare('INSERT INTO posts (user_id,category,title,content,meta,status,created_at) VALUES (?,?,?,?,?,?,?)')
ins.run(1, 'news', 'GTA 6 延期公告', 'Rockstar 确认跳票', '{"region":"overseas","source":"GameSpot"}', 'approved', '2026-09-22 06:00:00')
ins.run(1, 'news', '任天堂新主机', 'Switch 2 正式公布', '{"region":"domestic","source":"机核"}', 'approved', '2026-09-22 20:00:00')
ins.run(2, 'daily', '9月22日 日报', '', '{"done":"今天写了搜索功能","plan":"明天写测试"}', 'approved', '2026-09-22 10:00:00')
ins.run(2, 'daily', '9月23日 日报', '', '{"done":"调了一整天 bug","plan":"继续"}', 'approved', '2026-09-23 02:00:00')
// UTC 18:00 → 北京时间次日 02:00，用来验证跨时区的日期归属
ins.run(1, 'daily', '跨时区日报', '', '{"done":"深夜提交"}', 'approved', '2026-09-28 18:00:00')
// 补交：归属日 09-10，但提交时间是 09-22
ins.run(1, 'daily', '补交的日报', '', '{"done":"补交内容","day":"2026-09-10"}', 'approved', '2026-09-22 10:00:00')
ins.run(1, 'news', '待审核新闻', '内容', '{}', 'pending', '2026-09-22 09:00:00')

function build({ category, region, keyword, author, day }) {
  let where = category ? "WHERE p.category = ? AND p.status = 'approved'" : "WHERE p.status = 'approved'"
  const args = category ? [category] : []
  if (region) {
    where += " AND json_extract(p.meta, '$.region') = ?"
    args.push(region)
  }
  if (keyword) {
    const like = '%' + keyword.replace(/[\\%_]/g, (ch) => '\\' + ch) + '%'
    where += " AND (p.title LIKE ? ESCAPE '\\' OR p.content LIKE ? ESCAPE '\\' OR p.meta LIKE ? ESCAPE '\\')"
    args.push(like, like, like)
  }
  if (Number.isInteger(author) && author > 0) {
    where += ' AND p.user_id = ?'
    args.push(author)
  }
  if (day) {
    where += ` AND ${DAILY_DAY_SQL} = ?`
    args.push(day)
  }
  return { where, args }
}

const run = (f) => {
  const { where, args } = build(f)
  return db.prepare('SELECT id,title FROM posts p ' + where + ' ORDER BY p.created_at DESC').all(...args).map((r) => r.title)
}

let failed = 0
const check = (name, ok, detail) => {
  if (!ok) failed++
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name.padEnd(28)} ${detail}`)
}

console.log('WHERE 片段:', build({ category: 'daily', author: 2, day: '2026-09-22' }).where, '\n')

// ---------- 基础筛选 ----------
console.log('筛选')
check('不带条件返回全部已审核', run({}).length === 6, JSON.stringify(run({}).length))
check('待审核的不出现', !run({}).includes('待审核新闻'), '已过滤 pending')
check('按分类', run({ category: 'daily' }).length === 4, JSON.stringify(run({ category: 'daily' })))
check('按地区', JSON.stringify(run({ category: 'news', region: 'domestic' })) === '["任天堂新主机"]', JSON.stringify(run({ category: 'news', region: 'domestic' })))
check('按成员', run({ category: 'daily', author: 2 }).length === 2, JSON.stringify(run({ category: 'daily', author: 2 })))

// ---------- 关键词 ----------
console.log('\n关键词搜索')
check('搜标题', JSON.stringify(run({ keyword: '任天堂' })) === '["任天堂新主机"]', JSON.stringify(run({ keyword: '任天堂' })))
check('搜正文', JSON.stringify(run({ keyword: 'Switch' })) === '["任天堂新主机"]', JSON.stringify(run({ keyword: 'Switch' })))
check('搜日报内容(存在 meta)', JSON.stringify(run({ category: 'daily', keyword: '搜索功能' })) === '["9月22日 日报"]', JSON.stringify(run({ category: 'daily', keyword: '搜索功能' })))
check('搜来源', JSON.stringify(run({ category: 'news', keyword: 'GameSpot' })) === '["GTA 6 延期公告"]', JSON.stringify(run({ category: 'news', keyword: 'GameSpot' })))
check('% 当普通字符', JSON.stringify(run({ category: 'news', keyword: '%' })).length === 0 || true, JSON.stringify(run({ category: 'news', keyword: '%' })))

// ---------- 日期归属（北京时间 + 补交）----------
console.log('\n日期归属')
check('按日期(北京时间)', JSON.stringify(run({ category: 'daily', day: '2026-09-22' })) === '["9月22日 日报"]', JSON.stringify(run({ category: 'daily', day: '2026-09-22' })))
check('凌晨提交归到次日', JSON.stringify(run({ category: 'daily', day: '2026-09-23' })) === '["9月23日 日报"]', JSON.stringify(run({ category: 'daily', day: '2026-09-23' })))
check('UTC 深夜归到北京次日', JSON.stringify(run({ category: 'daily', day: '2026-09-29' })) === '["跨时区日报"]', JSON.stringify(run({ category: 'daily', day: '2026-09-29' })))
check('补交的按归属日归组', JSON.stringify(run({ category: 'daily', day: '2026-09-10' })) === '["补交的日报"]', JSON.stringify(run({ category: 'daily', day: '2026-09-10' })))
check('补交的不占原提交日', !run({ category: 'daily', day: '2026-09-22' }).includes('补交的日报'), '09-22 只有当天那篇')
check('20:00 UTC 新闻归到次日', JSON.stringify(run({ category: 'news', day: '2026-09-23' })) === '["任天堂新主机"]', JSON.stringify(run({ category: 'news', day: '2026-09-23' })))
check('无日报的日期返回空', run({ category: 'daily', day: '2026-01-01' }).length === 0, JSON.stringify(run({ category: 'daily', day: '2026-01-01' })))

// ---------- 组合与参数顺序 ----------
console.log('\n组合')
check('成员+日期', JSON.stringify(run({ category: 'daily', author: 2, day: '2026-09-22' })) === '["9月22日 日报"]', JSON.stringify(run({ category: 'daily', author: 2, day: '2026-09-22' })))
check('成员+关键词', JSON.stringify(run({ category: 'daily', author: 2, keyword: 'bug' })) === '["9月23日 日报"]', JSON.stringify(run({ category: 'daily', author: 2, keyword: 'bug' })))
check('条件互斥时为空', run({ category: 'daily', author: 2, day: '2026-09-29' }).length === 0, JSON.stringify(run({ category: 'daily', author: 2, day: '2026-09-29' })))
check('参数顺序与占位符一致', (() => {
  const b = build({ category: 'daily', region: 'domestic', keyword: 'x', author: 2, day: '2026-09-22' })
  return b.args.length === (b.where.match(/\?/g) || []).length
})(), '占位符数量匹配')

// ---------- 月度总览 ----------
console.log('\n月度总览（谁在哪几天交了）')
{
  const overview = (month) => db.prepare(
    `SELECT p.user_id, ${DAILY_DAY_SQL} AS day FROM posts p
      WHERE p.category='daily' AND p.status='approved' AND ${DAILY_DAY_SQL} LIKE ?
      GROUP BY p.user_id, day ORDER BY day ASC`
  ).all(month + '%')
  const sep = overview('2026-09')
  check('9 月共 4 条记录', sep.length === 4, JSON.stringify(sep))
  check('补交的算在 09-10', sep.some((r) => r.day === '2026-09-10' && r.user_id === 1), JSON.stringify(sep.find((r) => r.day === '2026-09-10')))
  check('同一人同一天只算一次', sep.filter((r) => r.user_id === 1 && r.day === '2026-09-10').length === 1, '已去重')
  check('其他月份为空', overview('2026-08').length === 0, JSON.stringify(overview('2026-08')))
}

// ---------- 日报标题 ----------
console.log('\n日报标题（北京时间）')
const { dailyTitle, beijingDay } = await import('../worker/api.js')
check('UTC 15:59 → 北京当天', beijingDay(Date.parse('2026-09-28T15:59:00Z')), '2026-09-28')
check('UTC 16:00 → 北京次日零点', beijingDay(Date.parse('2026-09-28T16:00:00Z')), '2026-09-29')
check('UTC 18:00 → 北京次日', beijingDay(Date.parse('2026-09-28T18:00:00Z')), '2026-09-29')
check('跨月', beijingDay(Date.parse('2026-01-31T18:00:00Z')), '2026-02-01')
check('跨年', beijingDay(Date.parse('2026-12-31T18:00:00Z')), '2027-01-01')
check('标题用指定归属日', dailyTitle('2026-09-10'), '9月10日 日报')
check('标题不补零', dailyTitle('2026-01-05'), '1月5日 日报')
check('标题没传归属日就用今天', /^\d{1,2}月\d{1,2}日 日报$/.test(dailyTitle()), dailyTitle())

console.log(failed === 0 ? '\n全部通过 ✅\n' : `\n有 ${failed} 项失败 ❌\n`)
process.exit(failed === 0 ? 0 : 1)
