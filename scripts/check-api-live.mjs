// 线上接口冒烟检查：node scripts/check-api-live.mjs
const BASE = 'https://xianyu.lgame.men/api/posts'

async function getJson(url, tries = 4) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
      const text = await res.text()
      const data = JSON.parse(text) // 网络截断会在这里抛错，从而触发重试
      return data
    } catch (e) {
      lastErr = e
      await new Promise((r) => setTimeout(r, 800))
    }
  }
  throw lastErr
}

const cases = [
  { label: '新闻不带关键词', q: null, expectAtLeast: 1 },
  { label: '搜「任天堂」', q: '任天堂', mustContain: '任天堂' },
  { label: '搜「Switch」', q: 'Switch', mustContain: 'switch' },
  { label: '搜「GTA」', q: 'GTA', mustContain: 'gta' },
  { label: '搜「%」（转义检查）', q: '%', mustContain: '%' },
  { label: '搜「zzz不存在」', q: 'zzz', expectTotal: 0 },
  // 日报：正文存在 meta 里，必须也能搜到
  { label: '日报搜「日报」', q: '日报', category: 'daily', expectAtLeast: 1 },
  { label: '日报搜正文(meta)', q: 'UE5', category: 'daily', expectAtLeast: 1 },
]

let failed = 0
for (const c of cases) {
  const url = `${BASE}?category=${c.category || 'news'}&pageSize=5${c.q === null ? '' : '&q=' + encodeURIComponent(c.q)}`
  try {
    const d = await getJson(url)
    const posts = d.posts || []
    let ok, detail

    if (c.expectAtLeast !== undefined) {
      ok = d.total >= c.expectAtLeast
      detail = `命中 ${d.total} 条`
    } else if (c.expectTotal !== undefined) {
      ok = d.total === c.expectTotal
      detail = `命中 ${d.total} 条（期望 ${c.expectTotal}）`
    } else {
      // 每条结果都必须真的包含关键词（日报正文在 meta 里，所以一并查）
      const bad = posts.filter((p) => !((p.title + p.content + (p.meta || '')).toLowerCase().includes(c.mustContain)))
      ok = posts.length > 0 && bad.length === 0
      detail = `命中 ${d.total} 条，本页 ${posts.length} 条，未命中的 ${bad.length} 条`
    }
    if (!ok) failed++
    console.log(`${ok ? '  PASS' : '  FAIL'}  ${c.label.padEnd(24)} ${detail}`)
    if (posts.length) console.log(`         例: ${posts[0].title.slice(0, 46)}`)
  } catch (e) {
    failed++
    console.log(`  FAIL  ${c.label.padEnd(24)} 请求失败: ${e.message}`)
  }
}

// 日报按日期筛选（归属日口径：meta.day 优先，否则按北京时间从 created_at 换算）
try {
  const d = await getJson(`${BASE}?category=daily&pageSize=50`)
  const dayOf = (p) => {
    let meta = {}
    try {
      meta = typeof p.meta === 'string' ? JSON.parse(p.meta) : p.meta || {}
    } catch {}
    if (/^\d{4}-\d{2}-\d{2}$/.test(meta.day || '')) return meta.day
    return new Date(new Date(p.created_at.replace(' ', 'T') + 'Z').getTime() + 8 * 3600e3).toISOString().slice(0, 10)
  }
  const day = dayOf(d.posts?.[0] || {})
  if (!day) throw new Error('没有日报数据，跳过')
  const onDay = await getJson(`${BASE}?category=daily&pageSize=50&date=${day}`)
  const expect = d.posts.filter((p) => dayOf(p) === day).length
  const ok = onDay.total === expect && onDay.posts.every((p) => dayOf(p) === day)
  if (!ok) failed++
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${'日报按日期筛选'.padEnd(24)} ${day} 应有 ${expect} 篇，接口返回 ${onDay.total} 篇`)
} catch (e) {
  failed++
  console.log(`  FAIL  ${'日报按日期筛选'.padEnd(24)} ${e.message}`)
}

// 需要登录的接口
for (const [path, label] of [['/api/members', '成员名单需登录'], ['/api/daily-overview', '月度总览需登录'], ['/api/daily-checkin', '打卡统计需登录']]) {
  try {
    const res = await fetch('https://xianyu.lgame.men' + path, { signal: AbortSignal.timeout(30000) })
    const ok = res.status === 401
    if (!ok) failed++
    console.log(`${ok ? '  PASS' : '  FAIL'}  ${label.padEnd(24)} 未登录返回 ${res.status}（期望 401）`)
  } catch (e) {
    failed++
    console.log(`  FAIL  ${label.padEnd(24)} ${e.message}`)
  }
}

console.log(failed === 0 ? '\n线上接口全部正常 ✅\n' : `\n有 ${failed} 项异常 ❌\n`)
process.exit(failed === 0 ? 0 : 1)
