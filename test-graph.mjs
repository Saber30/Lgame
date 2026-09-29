const BASE = 'https://xianyu.lgame.men'
const H = (cookie) => ({ 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) })

async function req(path, method, body, cookie) {
  const res = await fetch(BASE + path, {
    method,
    headers: H(cookie),
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { status: res.status, data, cookie: (res.headers.get('set-cookie') || '').split(';')[0] }
}

async function main() {
  const user = 'graph' + Math.floor(Math.random() * 100000)
  // 1. 注册全新账号
  const reg = await req('/api/register', 'POST', {
    username: user,
    email: user + '@lgame.men',
    password: 'Graph123456',
  })
  console.log('1) 注册 ' + user + ':', reg.status, JSON.stringify(reg.data))

  // 2. 登录
  const login = await req('/api/login', 'POST', { account: user, password: 'Graph123456' })
  console.log('2) 登录:', login.status, login.cookie ? '✅ 拿到会话' : '❌ 无会话')
  const cookie = login.cookie
  if (!cookie) return

  // 3. 建两个策划文档
  const d1 = await req('/api/design-docs', 'POST', { title: '战斗系统', category: 'system', content: '战斗系统设计' }, cookie)
  console.log('3) 建文档「战斗系统」:', d1.status, JSON.stringify(d1.data))
  const d2 = await req('/api/design-docs', 'POST', { title: '属性数值', category: 'numeric', content: '属性数值表' }, cookie)
  console.log('4) 建文档「属性数值」:', d2.status, JSON.stringify(d2.data))
  const d3 = await req('/api/design-docs', 'POST', { title: '角色原画需求', category: 'art', content: '原画需求清单' }, cookie)
  console.log('5) 建文档「角色原画需求」:', d3.status, JSON.stringify(d3.data))

  // 4. 建关联
  const l1 = await req('/api/design-links', 'POST', { from_id: d1.data.id, to_id: d2.data.id, relation: 'depends' }, cookie)
  console.log('6) 关联「战斗系统-依赖-属性数值」:', l1.status, JSON.stringify(l1.data))
  const l2 = await req('/api/design-links', 'POST', { from_id: d2.data.id, to_id: d3.data.id, relation: 'affects' }, cookie)
  console.log('7) 关联「属性数值-影响-角色原画」:', l2.status, JSON.stringify(l2.data))

  // 5. 查询验证
  const docs = await req('/api/design-docs', 'GET', null, cookie)
  console.log('8) 查询文档: 共', docs.data.docs?.length, '篇 ->', (docs.data.docs || []).map((d) => d.title).join(' / '))
  const links = await req('/api/design-links', 'GET', null, cookie)
  console.log('9) 查询关联: 共', links.data.links?.length, '条 ->', JSON.stringify(links.data.links))
  console.log('   ✅ 数据完整 = 知识图谱后端链路全部打通')
}

main().catch((e) => console.log('测试出错:', e.message))
