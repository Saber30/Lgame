// 验证搜索 SQL 与 LIKE 转义（node --experimental-sqlite scripts/test-search-sql.mjs）
import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync(':memory:')
db.exec('CREATE TABLE posts (id INTEGER PRIMARY KEY, category TEXT, title TEXT, content TEXT, status TEXT)')
const ins = db.prepare('INSERT INTO posts (category,title,content,status) VALUES (?,?,?,?)')
ins.run('news', 'GTA 6 延期公告', 'Rockstar 确认跳票', 'approved')
ins.run('news', '任天堂新主机', 'Switch 2 正式公布', 'approved')
ins.run('news', '100% 折扣活动', '限时免费领取', 'approved')
ins.run('news', 'under_score 测试', '含下划线的标题', 'approved')
ins.run('insight', '玩后感', '这游戏不错', 'approved')

// 复刻 worker/api.js handleListPosts 里的拼法
function build(category, keyword) {
  let where = category ? "WHERE p.category = ? AND p.status = 'approved'" : "WHERE p.status = 'approved'"
  const args = category ? [category] : []
  if (keyword) {
    const like = '%' + keyword.replace(/[\\%_]/g, (ch) => '\\' + ch) + '%'
    where += " AND (p.title LIKE ? ESCAPE '\\' OR p.content LIKE ? ESCAPE '\\')"
    args.push(like, like)
  }
  return { where, args }
}

const run = (category, keyword) => {
  const { where, args } = build(category, keyword)
  return db.prepare('SELECT id,title FROM posts p ' + where + ' ORDER BY p.id').all(...args).map((r) => r.title)
}

let failed = 0
const check = (name, ok, detail) => {
  if (!ok) failed++
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}  → ${detail}`)
}

console.log('SQL 片段:', build('news', '测试').where, '\n')
check('中文关键词', JSON.stringify(run('news', '任天堂')) === '["任天堂新主机"]', JSON.stringify(run('news', '任天堂')))
check('英文大小写不敏感', JSON.stringify(run('news', 'rockstar')).length > 2, JSON.stringify(run('news', 'rockstar')))
check('搜索正文内容', JSON.stringify(run('news', 'Switch')) === '["任天堂新主机"]', JSON.stringify(run('news', 'Switch')))
check('% 被当成普通字符', JSON.stringify(run('news', '%')) === '["100% 折扣活动"]', JSON.stringify(run('news', '%')))
check('100% 精确匹配', JSON.stringify(run('news', '100%')) === '["100% 折扣活动"]', JSON.stringify(run('news', '100%')))
check('_ 被当成普通字符', JSON.stringify(run('news', '_')) === '["under_score 测试"]', JSON.stringify(run('news', '_')))
check('反斜杠不报错', Array.isArray(run('news', '\\')), JSON.stringify(run('news', '\\')))
check('无关键词返回全部', run('news', '').length === 4, JSON.stringify(run('news', '').length))
check('分类 + 关键词', JSON.stringify(run('insight', '游戏')) === '["玩后感"]', JSON.stringify(run('insight', '游戏')))
check('搜不到时返回空数组', run('news', '不存在的词xyz').length === 0, JSON.stringify(run('news', '不存在的词xyz')))

console.log(failed === 0 ? '\n全部通过 ✅\n' : `\n有 ${failed} 项失败 ❌\n`)
process.exit(failed === 0 ? 0 : 1)
