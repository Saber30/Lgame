// 吃豆人核心逻辑的无头测试：npm test
import {
  CELL,
  COLS,
  DOT_SCORE,
  READY_FRAMES,
  createGame,
  createStepper,
  isWall,
  scatterFramesFor,
  setDirection,
  setPaused,
  start,
  stepFrame,
  togglePause,
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

const manhattan = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
const pacCell = (s) => [Math.floor(s.pac.x / CELL), Math.floor(s.pac.y / CELL)]
const ghostCell = (g) => [g.col, g.row]

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
  check('开局先散开给玩家缓冲', g.mode === 'scatter', `${g.mode}/${g.modeTimer}`)
  check('开局带准备时间', g.ready === READY_FRAMES, `${g.ready}`)
}

// ---------- 测试 2：准备时间 ----------
console.log('\n[2] 开局准备时间（这段时间谁都不动）')
{
  const g = createGame()
  start(g)
  const pac0 = [g.pac.x, g.pac.y]
  const ghost0 = [g.ghosts[0].x, g.ghosts[0].y]

  const ev = stepFrame(g)
  check('准备期间返回 ready 事件', ev && ev.ready === true, JSON.stringify(ev))
  setDirection(g, 1, 0) // 玩家提前按键
  for (let i = 0; i < READY_FRAMES - 2; i++) stepFrame(g)

  check('准备期间吃豆人不动', g.pac.x === pac0[0] && g.pac.y === pac0[1])
  check('准备期间幽灵不动', g.ghosts[0].x === ghost0[0] && g.ghosts[0].y === ghost0[1])

  for (let i = 0; i < 12; i++) stepFrame(g)
  check('准备结束后吃豆人开始移动', g.pac.x > pac0[0], `x=${g.pac.x}`)
  check('准备结束后幽灵开始移动', g.ghosts[0].x !== ghost0[0] || g.ghosts[0].y !== ghost0[1])
}

// ---------- 测试 3：暂停 ----------
console.log('\n[3] 暂停 / 继续')
{
  const g = createGame()
  start(g)
  g.ready = 0
  setDirection(g, 1, 0)
  for (let i = 0; i < 20; i++) stepFrame(g)

  togglePause(g)
  const pacX = g.pac.x
  const ghostX = g.ghosts[0].x
  check('暂停后 stepFrame 不推进', stepFrame(g) === null)
  for (let i = 0; i < 30; i++) stepFrame(g)
  check('暂停期间吃豆人不动', g.pac.x === pacX)
  check('暂停期间幽灵不动', g.ghosts[0].x === ghostX)

  togglePause(g)
  check('继续后恢复推进', stepFrame(g) !== null)

  setPaused(g, true)
  check('setPaused(true) 生效', g.paused === true)
  setPaused(g, false)
  check('setPaused(false) 生效', g.paused === false)
}

// ---------- 测试 4：追击 / 散开模式 ----------
console.log('\n[4] 追击 / 散开模式')
{
  const chase = createGame()
  start(chase)
  chase.ready = 0
  chase.mode = 'chase'
  chase.modeTimer = 999999
  let caughtFrame = null
  for (let i = 0; i < 1200; i++) {
    if (stepFrame(chase)?.caught) { caughtFrame = i; break }
  }
  check('追击模式下幽灵会抓到静止的吃豆人', caughtFrame !== null, caughtFrame === null ? '1200 帧内没抓到' : `${caughtFrame} 帧`)

  // 对比同一位置幽灵在两种模式下与老家的平均距离：散开时应该守着老家，追击时应该跑远
  const avgHomeDist = (mode) => {
    const s = createGame()
    start(s)
    s.ready = 0
    s.mode = mode
    s.modeTimer = 999999
    const home = s.ghosts[0].home
    let sum = 0
    let n = 0
    for (let i = 0; i < 600; i++) {
      stepFrame(s)
      if (!s.playing) break
      sum += manhattan(ghostCell(s.ghosts[0]), home)
      n++
    }
    return { avg: n ? sum / n : 0, alive: s.playing }
  }
  const scatterStat = avgHomeDist('scatter')
  const chaseStat = avgHomeDist('chase')
  check('散开时幽灵守着老家，追击时跑向吃豆人', scatterStat.avg < chaseStat.avg, `散开平均离老家 ${scatterStat.avg.toFixed(1)} 格 / 追击 ${chaseStat.avg.toFixed(1)} 格`)
  check('散开模式下不会抓到吃豆人', scatterStat.alive === true)

  const timer = createGame()
  start(timer)
  timer.ghosts = [] // 去掉幽灵，避免提前被抓导致推进中断
  check('模式计时器初始为散开', timer.mode === 'scatter')
  for (let i = 0; i < READY_FRAMES + scatterFramesFor(1) + 2; i++) stepFrame(timer)
  check('散开时长走完后切到追击', timer.mode === 'chase', `当前 ${timer.mode}`)

  // 掉头请求是瞬时标记，构造一个正在向右走的幽灵单独验证
  const rev = createGame()
  start(rev)
  rev.ready = 0
  const rg = rev.ghosts[0]
  rg.col = 15
  rg.row = 1
  rg.tx = 16
  rg.ty = 1
  rg.dx = 1
  rg.dy = 0
  rg.x = 15 * CELL + CELL / 2
  rg.y = 1 * CELL + CELL / 2
  rg.reverse = true
  let reversed = false
  for (let i = 0; i < 40; i++) {
    stepFrame(rev)
    if (rg.dx === -1) reversed = true
  }
  check('掉头请求会让幽灵反向', reversed, `最终方向 dx=${rg.dx}`)
}

// ---------- 测试 5：吃豆事件带出坐标 ----------
console.log('\n[5] 吃豆事件')
{
  const g = createGame()
  start(g)
  g.ready = 0
  setDirection(g, 1, 0)
  let at = null
  let count = 0
  for (let i = 0; i < 300; i++) {
    const ev = stepFrame(g)
    if (ev?.ateDotAt) { at = ev.ateDotAt; count++ }
  }
  check('事件里带出被吃掉豆子的坐标', at && at.row === 1 && at.col >= 2, JSON.stringify(at))
  check('吃豆事件数量与得分一致', count * DOT_SCORE === g.score, `${count} 颗 / ${g.score} 分`)
}

// ---------- 测试 6：幽灵能抓到人（新旧算法对比）----------
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

console.log('\n[6] 幽灵追逐静止的吃豆人（吃豆人不动，看幽灵多久能抓到）')
{
  const legacyRuns = []
  for (let i = 0; i < 3; i++) legacyRuns.push(runChase((s, gh) => legacyGhostStep(s, gh), 20000))
  const legacyCaught = legacyRuns.filter((r) => r.frames !== null).length
  console.log(`  旧算法 3 次尝试：抓到 ${legacyCaught}/3 次，走过的格子数 ${legacyRuns.map((r) => r.cells).join(', ')}`)

  const runs = []
  for (let i = 0; i < 5; i++) runs.push(runChase((s) => stepFrame(s), 12000))
  check('新算法 5/5 都能抓到吃豆人', runs.every((r) => r.frames !== null), runs.map((r) => (r.frames === null ? '未抓到' : r.frames + ' 帧')).join(', '))
  check('每次都在 12000 帧内抓到（旧算法 2 万帧都抓不到）', runs.every((r) => r.frames !== null && r.frames <= 12000))
  check('幽灵在推进而不是原地摆动', runs.every((r) => r.cells >= 15), '访问格子数 ' + runs.map((r) => r.cells).join(', '))
}

// ---------- 测试 7：吃光豆子能进入下一关 ----------
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

console.log('\n[7] 吃光全部豆子 → 进入下一关（无限循环）')
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
  check('过关后重新给准备时间', g.ready === READY_FRAMES, `${g.ready}`)
  check('第 2 关幽灵数量增加', g.ghosts.length === 2, `实际 ${g.ghosts.length}`)
  console.log(`  通关 1 关用了 ${r.frames} 帧`)
}

// ---------- 测试 8：连续多关循环 ----------
console.log('\n[8] 连续 3 关循环')
{
  const g = createGame()
  start(g)
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

// ---------- 测试 9：被抓住后重开 ----------
console.log('\n[9] 被抓住 → 重开')
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
  check('重开后清除暂停状态', g.paused === false)
  check('重开后重置模式', g.mode === 'scatter' && g.ready === READY_FRAMES)
}

// ---------- 测试 10：固定步长推进（与屏幕刷新率无关）----------
console.log('\n[10] 固定步长推进（游戏速度不该受屏幕刷新率影响）')
{
  const stepsIn = (hz, totalMs) => {
    const g = createGame()
    start(g)
    const advance = createStepper(g)
    const chunk = 1000 / hz
    let elapsed = 0
    let steps = 0
    while (elapsed < totalMs) {
      steps += advance(chunk).length
      elapsed += chunk
    }
    return steps
  }
  const at60 = stepsIn(60, 5000)
  const at144 = stepsIn(144, 5000)
  check('60Hz 屏：5 秒推进约 300 个逻辑帧', Math.abs(at60 - 300) <= 3, `${at60} 帧`)
  check('144Hz 屏：5 秒推进约 300 个逻辑帧', Math.abs(at144 - 300) <= 3, `${at144} 帧`)
  check('两种刷新率下速度一致', Math.abs(at60 - at144) <= 3, `${at60} vs ${at144}`)

  const g2 = createGame()
  start(g2)
  const advance2 = createStepper(g2)
  check('切标签页后回来不会一次性快进', advance2(5000).length <= 1, `推进了 ${advance2(5000).length} 帧`)

  const g3 = createGame()
  const advance3 = createStepper(g3)
  check('未开局时不推进', advance3(16.7).length === 0)
}

console.log(failed === 0 ? '\n全部通过 ✅\n' : `\n有 ${failed} 项失败 ❌\n`)
process.exit(failed === 0 ? 0 : 1)
