// 验证线上搜索接口：node scripts/check-search-live.mjs
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
  { label: '不带关键词', q: null, expectAtLeast: 1 },
  { label: '搜「任天堂」', q: '任天堂', mustContain: '任天堂' },
  { label: '搜「Switch」', q: 'Switch', mustContain: 'switch' },
  { label: '搜「GTA」', q: 'GTA', mustContain: 'gta' },
  { label: '搜「%」（转义检查）', q: '%', mustContain: '%' },
  { label: '搜「zzz不存在」', q: 'zzz', expectTotal: 0 },
]

let failed = 0
for (const c of cases) {
  const url = `${BASE}?category=news&pageSize=5${c.q === null ? '' : '&q=' + encodeURIComponent(c.q)}`
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
      // 每条结果都必须真的包含关键词，否则说明过滤没生效
      const bad = posts.filter((p) => !((p.title + p.content).toLowerCase().includes(c.mustContain)))
      ok = posts.length > 0 && bad.length === 0
      detail = `命中 ${d.total} 条，本页 ${posts.length} 条，未命中的 ${bad.length} 条`
    }
    if (!ok) failed++
    console.log(`${ok ? '  PASS' : '  FAIL'}  ${c.label.padEnd(22)} ${detail}`)
    if (posts.length) console.log(`         例: ${posts[0].title.slice(0, 46)}`)
  } catch (e) {
    failed++
    console.log(`  FAIL  ${c.label.padEnd(22)} 请求失败: ${e.message}`)
  }
}

console.log(failed === 0 ? '\n线上搜索全部正常 ✅\n' : `\n有 ${failed} 项异常 ❌\n`)
process.exit(failed === 0 ? 0 : 1)
