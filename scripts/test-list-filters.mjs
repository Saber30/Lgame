// 验证列表接口的筛选 SQL：node --no-warnings --experimental-sqlite scripts/test-list-filters.mjs
// 复刻 worker/api.js handleListPosts 里的 WHERE 拼法与参数顺序
import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync(':memory:')
db.exec('CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER, category TEXT, title TEXT, content TEXT, meta TEXT, status TEXT, created_at TEXT)')
const ins = db.prepare('INSERT INTO posts (user_id,category,title,content,meta,status,created_at) VALUES (?,?,?,?,?,?,?)')
ins.run(1, 'news', 'GTA 6 延期公告', 'Rockstar 确认跳票', '{"region":"overseas","source":"GameSpot"}', 'approved', '2026-09-22 06:00:00')
ins.run(1, 'news', '任天堂新主机', 'Switch 2 正式公布', '{"region":"domestic","source":"机核"}', 'approved', '2026-09-22 20:00:00')
ins.run(2, 'daily', '9月22日 日报', '', '{"done":"今天写了搜索功能","plan":"明天写测试"}', 'approved', '2026-09-22 10:00:00')
ins.run(2, 'daily', '9月23日 日报', '', '{"done":"调了一整天 bug","plan":"继续"}', 'approved', '2026-09-23 02:00:00')
// UTC 18:00 → 北京时间次日 02:00，用来验证跨时区的日期归属
ins.run(1, 'daily', '跨时区日报', '', '{"done":"深夜提交"}', 'approved', '2026-09-28 18:00:00')
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
    where += " AND date(p.created_at, '+8 hours') = ?"
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

// 基础
check('不带条件返回全部已审核', run({}).length === 5, JSON.stringify(run({}).length))
check('按分类', JSON.stringify(run({ category: 'daily' })) === '["跨时区日报","9月23日 日报","9月22日 日报"]', JSON.stringify(run({ category: 'daily' })))
check('按地区', JSON.stringify(run({ category: 'news', region: 'domestic' })) === '["任天堂新主机"]', JSON.stringify(run({ category: 'news', region: 'domestic' })))
check('待审核的不出现', !run({}).includes('待审核新闻'), '已过滤 pending')

// 关键词
check('搜标题', JSON.stringify(run({ keyword: '任天堂' })) === '["任天堂新主机"]', JSON.stringify(run({ keyword: '任天堂' })))
check('搜正文', JSON.stringify(run({ keyword: 'Switch' })) === '["任天堂新主机"]', JSON.stringify(run({ keyword: 'Switch' })))
check('搜日报内容(存在 meta 里)', JSON.stringify(run({ category: 'daily', keyword: '搜索功能' })) === '["9月22日 日报"]', JSON.stringify(run({ category: 'daily', keyword: '搜索功能' })))
check('搜来源', JSON.stringify(run({ category: 'news', keyword: 'GameSpot' })) === '["GTA 6 延期公告"]', JSON.stringify(run({ category: 'news', keyword: 'GameSpot' })))

// 按成员
check('按成员(2 号)', run({ category: 'daily', author: 2 }).length === 2, JSON.stringify(run({ category: 'daily', author: 2 })))
check('按成员(1 号)', JSON.stringify(run({ category: 'daily', author: 1 })) === '["跨时区日报"]', JSON.stringify(run({ category: 'daily', author: 1 })))
check('成员筛选不影响其他分类', run({ category: 'news', author: 1 }).length === 2, JSON.stringify(run({ category: 'news', author: 1 })))

// 按日期（北京时间）
check('按日期(北京时间)', JSON.stringify(run({ category: 'daily', day: '2026-09-22' })) === '["9月22日 日报"]', JSON.stringify(run({ category: 'daily', day: '2026-09-22' })))
check('凌晨提交归到次日', JSON.stringify(run({ category: 'daily', day: '2026-09-23' })) === '["9月23日 日报"]', JSON.stringify(run({ category: 'daily', day: '2026-09-23' })))
check('UTC 深夜提交归到北京次日', JSON.stringify(run({ category: 'daily', day: '2026-09-29' })) === '["跨时区日报"]', JSON.stringify(run({ category: 'daily', day: '2026-09-29' })))
// 20:00 UTC + 8h = 次日 04:00，所以这条新闻属于 23 号
check('按日期(新闻也适用)', JSON.stringify(run({ category: 'news', day: '2026-09-22' })) === '["GTA 6 延期公告"]', JSON.stringify(run({ category: 'news', day: '2026-09-22' })))
check('新闻的跨时区归属', JSON.stringify(run({ category: 'news', day: '2026-09-23' })) === '["任天堂新主机"]', JSON.stringify(run({ category: 'news', day: '2026-09-23' })))
check('无日报的日期返回空', run({ category: 'daily', day: '2026-01-01' }).length === 0, JSON.stringify(run({ category: 'daily', day: '2026-01-01' })))

// 组合
check('成员+日期', JSON.stringify(run({ category: 'daily', author: 2, day: '2026-09-22' })) === '["9月22日 日报"]', JSON.stringify(run({ category: 'daily', author: 2, day: '2026-09-22' })))
check('成员+关键词', JSON.stringify(run({ category: 'daily', author: 2, keyword: 'bug' })) === '["9月23日 日报"]', JSON.stringify(run({ category: 'daily', author: 2, keyword: 'bug' })))
check('条件互斥时为空', run({ category: 'daily', author: 2, day: '2026-09-29' }).length === 0, JSON.stringify(run({ category: 'daily', author: 2, day: '2026-09-29' })))

// 参数顺序必须和 WHERE 里的 ? 一一对应
check('参数顺序与占位符一致', (() => {
  const b = build({ category: 'daily', region: 'domestic', keyword: 'x', author: 2, day: '2026-09-22' })
  return b.args.length === (b.where.match(/\?/g) || []).length
})(), '占位符数量匹配')

// ---------- 日报默认标题的时区 ----------
// 必须和打卡统计的 date(created_at, '+8 hours') 口径一致
const { dailyTitle } = await import('../worker/api.js')
console.log('\n日报默认标题（北京时间）')
check('UTC 15:59 → 北京当天', dailyTitle(Date.parse('2026-09-28T15:59:00Z')), '9月28日 日报')
check('UTC 16:00 → 北京次日零点', dailyTitle(Date.parse('2026-09-28T16:00:00Z')), '9月29日 日报')
check('UTC 18:00 → 北京次日', dailyTitle(Date.parse('2026-09-28T18:00:00Z')), '9月29日 日报')
check('跨月', dailyTitle(Date.parse('2026-01-31T18:00:00Z')), '2月1日 日报')
check('跨年', dailyTitle(Date.parse('2026-12-31T18:00:00Z')), '1月1日 日报')

console.log(failed === 0 ? '\n全部通过 ✅\n' : `\n有 ${failed} 项失败 ❌\n`)
process.exit(failed === 0 ? 0 : 1)
