// 吃豆人核心逻辑的无头测试：node scripts/test-pacman.mjs
import {
  CELL,
  COLS,
  ROWS,
  DOT_SCORE,
  createGame,
  isWall,
  setDirection,
  start,
  stepFrame,
} from '../src/game/pacman.js'

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? '  → ' + detail : ''}`)
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

// ---------- 测试 1：初始状态 ----------
console.log('\n[1] 初始状态')
{
  const g = createGame()
  check('第 1 关', g.level === 1)
  check('分数从 0 开始', g.score === 0)
  check('幽灵数量为 1', g.ghosts.length === 1, `实际 ${g.ghosts.length}`)
  check('吃豆人起点在 (1,1) 格心', g.pac.x === 1 * CELL + CELL / 2 && g.pac.y === 1 * CELL + CELL / 2)
  check('豆子总数 = 142', g.dotsTotal === 142, `实际 ${g.dotsTotal}`)
  check('未开始时不推进', stepFrame(g) === null)
}

// ---------- 测试 2：幽灵能抓到静止的吃豆人 ----------
// 这是原来最关键的缺陷：幽灵在墙角左右摆动，807 帧都抓不到人。
const legacyGhostStep = (state, g) => {
  const dirs = DIRS.filter(([dx, dy]) => {
    const nx = g.x + dx * (CELL / 2 + 2)
    const ny = g.y + dy * (CELL / 2 + 2)
    return !isWall(Math.floor(nx / CELL), Math.floor(ny / CELL))
  })
  if (!dirs.length) return
  let pick
  if (Math.random() < 0.7) {
    dirs.sort((a, b) => {
      const da = Math.abs(g.x + a[0] * CELL - state.pac.x) + Math.abs(g.y + a[1] * CELL - state.pac.y)
      const db = Math.abs(g.x + b[0] * CELL - state.pac.x) + Math.abs(g.y + b[1] * CELL - state.pac.y)
      return da - db
    })
    pick = dirs[0]
  } else {
    pick = dirs[Math.floor(Math.random() * dirs.length)]
  }
  g.dx = pick[0]
  g.dy = pick[1]
  g.x += g.dx * g.speed
  g.y += g.dy * g.speed
}

const runChase = (stepGhost, maxFrames) => {
  const g = createGame()
  start(g)
  const ghost = g.ghosts[0]
  const visited = new Set()
  for (let f = 0; f < maxFrames; f++) {
    stepGhost(g, ghost)
    visited.add(`${Math.floor(ghost.x / CELL)},${Math.floor(ghost.y / CELL)}`)
    if (Math.abs(ghost.x - g.pac.x) < CELL * 0.7 && Math.abs(ghost.y - g.pac.y) < CELL * 0.7) {
      return { frames: f, cells: visited.size }
    }
  }
  return { frames: null, cells: visited.size }
}

console.log('\n[2] 幽灵追逐静止的吃豆人（吃豆人不动，看幽灵多久能抓到）')
{
  // 旧逻辑：像素级贪婪寻路，没有「禁止掉头」，平局时固定偏向一侧
  const legacyRuns = []
  for (let i = 0; i < 3; i++) legacyRuns.push(runChase((s, gh) => legacyGhostStep(s, gh), 20000))
  const legacyCaught = legacyRuns.filter((r) => r.frames !== null).length
  console.log(`  旧算法 3 次尝试：抓到 ${legacyCaught}/3 次，走过的格子数 ${legacyRuns.map((r) => r.cells).join(', ')}`)

  const runs = []
  for (let i = 0; i < 5; i++) runs.push(runChase((s, gh) => stepFrame(s), 20000))
  const caughtAll = runs.every((r) => r.frames !== null)
  check('新算法 5/5 都能抓到吃豆人', caughtAll, runs.map((r) => (r.frames === null ? '未抓到' : r.frames + ' 帧')).join(', '))
  check('每次都在 3000 帧内抓到（旧算法 2 万帧都抓不到）', runs.every((r) => r.frames !== null && r.frames <= 3000))
  check('幽灵在推进而不是原地摆动', runs.every((r) => r.cells >= 15), '访问格子数 ' + runs.map((r) => r.cells).join(', '))
}

// ---------- 测试 3：吃光豆子能进入下一关 ----------
const bfsFirstDir = (state, col, row) => {
  const key = (c, r) => r * COLS + c
  const startKey = key(col, row)
  const prev = new Map([[startKey, null]])
  const queue = [startKey]
  while (queue.length) {
    const cur = queue.shift()
    const cc = cur % COLS
    const cr = (cur - cc) / COLS
    for (const [dx, dy] of DIRS) {
      const nc = cc + dx
      const nr = cr + dy
      if (isWall(nc, nr)) continue
      const nk = key(nc, nr)
      if (prev.has(nk)) continue
      prev.set(nk, { from: cur, dir: [dx, dy] })
      if (state.grid[nr][nc] === 1) {
        // 回溯到「父节点是起点」的那一格，它的 dir 就是第一步
        let node = nk
        while (prev.get(node).from !== startKey) node = prev.get(node).from
        return prev.get(node).dir
      }
      queue.push(nk)
    }
  }
  return null
}

const atCenter = (v) => Math.abs(v - (Math.floor(v / CELL) * CELL + CELL / 2)) < 2.1

/** 用 BFS 自动把一关的豆子吃光，返回消耗帧数与事件统计 */
const autoClearLevel = (state, maxFrames = 200000) => {
  let frames = 0
  let levels = 0
  while (frames < maxFrames) {
    const p = state.pac
    if (atCenter(p.x) && atCenter(p.y)) {
      const dir = bfsFirstDir(state, Math.floor(p.x / CELL), Math.floor(p.y / CELL))
      if (dir) setDirection(state, dir[0], dir[1])
    }
    const ev = stepFrame(state)
    frames++
    if (!ev) break
    if (ev.levelUp) {
      levels++
      break
    }
  }
  return { frames, levels }
}

console.log('\n[3] 吃光全部豆子 → 进入下一关（无限循环）')
{
  const g = createGame()
  start(g)
  g.ghosts = [] // 单独验证关卡循环，先去掉幽灵
  const before = g.dotsTotal
  const r = autoClearLevel(g)
  check('吃光后关卡 +1', g.level === 2, `关卡 ${g.level}`)
  check('过关后豆子重新铺满', g.dotsLeft === before, `${g.dotsLeft}/${before}`)
  check('过关不清空分数', g.score === before * DOT_SCORE, `分数 ${g.score}`)
  check('吃豆人回到起点', g.pac.x === 1 * CELL + CELL / 2 && g.pac.y === 1 * CELL + CELL / 2)
  check('第 2 关幽灵数量增加', g.ghosts.length === 2, `实际 ${g.ghosts.length}`)
  console.log(`  通关 1 关用了 ${r.frames} 帧`)
}

// ---------- 测试 4：连续多关循环 ----------
console.log('\n[4] 连续 3 关循环')
{
  const g = createGame()
  start(g)
  g.ghosts = []
  const per = g.dotsTotal * DOT_SCORE
  let frames = 0
  for (let i = 0; i < 3; i++) {
    g.ghosts = []
    const r = autoClearLevel(g)
    frames += r.frames
    if (!r.levels) break
  }
  check('连过 3 关后关卡 = 4', g.level === 4, `关卡 ${g.level}`)
  check('累计分数正确', g.score === per * 3, `分数 ${g.score}，期望 ${per * 3}`)
  check('最高分同步', g.best === g.score, `最高分 ${g.best}`)
  console.log(`  3 关共 ${frames} 帧`)
}

// ---------- 测试 5：被抓住后重开 ----------
console.log('\n[5] 被抓住 → 重开')
{
  const g = createGame()
  start(g)
  g.score = 500
  g.level = 3
  g.playing = false
  g.gameOver = true
  start(g)
  check('重开后分数归零', g.score === 0, `分数 ${g.score}`)
  check('重开后回到第 1 关', g.level === 1, `关卡 ${g.level}`)
  check('重开后可以继续操作', g.playing === true && g.gameOver === false)
  check('重开后幽灵恢复为 1 只', g.ghosts.length === 1, `实际 ${g.ghosts.length}`)
}

console.log(failed === 0 ? '\n全部通过 ✅\n' : `\n有 ${failed} 项失败 ❌\n`)
process.exit(failed === 0 ? 0 : 1)
