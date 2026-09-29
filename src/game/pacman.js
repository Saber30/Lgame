// 吃豆人核心逻辑（纯函数式状态机，不依赖 DOM，方便无头测试）
// 地图字符：'#'=墙 '.'=豆子 ' '=空 'P'=吃豆人起点 'G'=幽灵起点

export const MAP = [
  '###################',
  '#P.......#.......G#',
  '#.##.###.#.###.##.#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '###.#.###.###.#.###',
  '#...#.......#...#.#',
  '#.###.#####.###.#.#',
  '#.........#.......#',
  '#.##.###.#.###.##.#',
  '#.................#',
  '#.##.###.#.###.##.#',
  '#........#........#',
  '###################',
]

export const COLS = MAP[0].length
export const ROWS = MAP.length
export const CELL = 24

export const PAC_SPEED = 1.6
export const DOT_SCORE = 10
export const CHASE_CHANCE = 0.8

// 幽灵出生点，按顺序启用（关卡越高启用越多）
const GHOST_SPAWNS = [
  [17, 1],
  [1, 13],
  [17, 13],
  [1, 7],
]
const GHOST_COLORS = ['#ff5b5b', '#ffb02e', '#4dc9ff', '#ff8ad8']

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

export function isWall(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true
  return MAP[row][col] === '#'
}

function center(col, row) {
  return [col * CELL + CELL / 2, row * CELL + CELL / 2]
}

/** 每关幽灵数量：第 1 关 1 只，之后每 2 关加 1 只，最多 4 只 */
export function ghostCountFor(level) {
  return Math.min(1 + Math.floor(level / 2), GHOST_SPAWNS.length)
}

/** 幽灵速度随关卡提升，但始终略慢于吃豆人，保证可玩 */
function ghostSpeedFor(level) {
  return PAC_SPEED * Math.min(0.95, 0.8 + level * 0.02)
}

export function createGame() {
  const state = { score: 0, level: 1, best: 0, playing: false, gameOver: false, tick: 0 }
  resetLevel(state, true)
  return state
}

/** fullReset=true 时连分数和关卡一起重置 */
export function resetLevel(state, fullReset) {
  // 必须先重置关卡号：幽灵数量是按关卡算的
  if (fullReset) {
    state.score = 0
    state.level = 1
    state.gameOver = false
  }

  state.grid = []
  state.dotsLeft = 0
  state.dotsTotal = 0

  let pacStart = [1, 1]
  for (let r = 0; r < ROWS; r++) {
    const row = []
    for (let c = 0; c < COLS; c++) {
      const ch = MAP[r][c]
      if (ch === '.') {
        row.push(1)
        state.dotsLeft++
      } else {
        row.push(0)
        if (ch === 'P') pacStart = [c, r]
      }
    }
    state.grid.push(row)
  }
  state.dotsTotal = state.dotsLeft

  const [px, py] = center(pacStart[0], pacStart[1])
  state.pac = { x: px, y: py, dx: 0, dy: 0, ndx: 0, ndy: 0, mouth: 0 }

  const speed = ghostSpeedFor(state.level)
  state.ghosts = GHOST_SPAWNS.slice(0, ghostCountFor(state.level)).map(([c, r], i) => {
    const [gx, gy] = center(c, r)
    return {
      col: c,
      row: r,
      tx: c,
      ty: r,
      x: gx,
      y: gy,
      dx: 0,
      dy: 0,
      speed,
      color: GHOST_COLORS[i % GHOST_COLORS.length],
    }
  })

  state.tick = 0
}

export function start(state) {
  resetLevel(state, true)
  state.playing = true
  state.gameOver = false
}

/** 记录玩家想走的方向，实际转向在能走通时才生效 */
export function setDirection(state, dx, dy) {
  if (!state.playing || state.gameOver) return
  state.pac.ndx = dx
  state.pac.ndy = dy
}

function canMove(x, y, dx, dy) {
  const nx = x + dx * (CELL / 2 + 2)
  const ny = y + dy * (CELL / 2 + 2)
  return !isWall(Math.floor(nx / CELL), Math.floor(ny / CELL))
}

function updatePac(state) {
  const p = state.pac
  if (p.ndx || p.ndy) {
    if (canMove(p.x, p.y, p.ndx, p.ndy)) {
      // 转向时把另一条轴对齐到通道中线，避免长期偏离格心
      if (p.ndx) p.y = Math.floor(p.y / CELL) * CELL + CELL / 2
      else p.x = Math.floor(p.x / CELL) * CELL + CELL / 2
      p.dx = p.ndx
      p.dy = p.ndy
      p.ndx = 0
      p.ndy = 0
    }
  }
  if (p.dx || p.dy) {
    if (canMove(p.x, p.y, p.dx, p.dy)) {
      p.x += p.dx * PAC_SPEED
      p.y += p.dy * PAC_SPEED
      p.mouth += 0.15
    }
  }
  const c = Math.floor(p.x / CELL)
  const r = Math.floor(p.y / CELL)
  if (state.grid[r] && state.grid[r][c] === 1) {
    state.grid[r][c] = 0
    state.score += DOT_SCORE
    state.dotsLeft--
    if (state.score > state.best) state.best = state.score
  }
}

/**
 * 幽灵在格心做一次决策。
 * 关键点：排除「原地掉头」，否则在墙角会左右来回摆动，永远追不到人。
 */
function chooseGhostDir(state, g) {
  const open = DIRS.filter(([dx, dy]) => !isWall(g.col + dx, g.row + dy))
  if (!open.length) return null

  let cands = open.filter(([dx, dy]) => !(dx === -g.dx && dy === -g.dy))
  if (!cands.length) cands = open

  if (Math.random() >= CHASE_CHANCE) {
    return cands[Math.floor(Math.random() * cands.length)]
  }

  const pc = Math.floor(state.pac.x / CELL)
  const pr = Math.floor(state.pac.y / CELL)
  const dist = ([dx, dy]) => Math.abs(g.col + dx - pc) + Math.abs(g.row + dy - pr)
  const best = Math.min(...cands.map(dist))
  const tied = cands.filter((d) => dist(d) === best)
  // 平局随机，避免固定偏向某一侧导致绕圈
  return tied[Math.floor(Math.random() * tied.length)]
}

function updateGhost(state, g) {
  const [gx, gy] = center(g.tx, g.ty)
  if (g.x !== gx) g.x += Math.sign(gx - g.x) * Math.min(g.speed, Math.abs(gx - g.x))
  if (g.y !== gy) g.y += Math.sign(gy - g.y) * Math.min(g.speed, Math.abs(gy - g.y))

  if (g.x !== gx || g.y !== gy) return

  g.col = g.tx
  g.row = g.ty
  const dir = chooseGhostDir(state, g)
  if (dir) {
    g.dx = dir[0]
    g.dy = dir[1]
    g.tx = g.col + g.dx
    g.ty = g.row + g.dy
  } else {
    g.dx = 0
    g.dy = 0
  }
}

function caught(state) {
  const p = state.pac
  return state.ghosts.some((g) => Math.abs(g.x - p.x) < CELL * 0.7 && Math.abs(g.y - p.y) < CELL * 0.7)
}

/**
 * 推进一帧。返回本帧发生的事件：{ ateDot } / { levelUp } / { caught }
 */
export function stepFrame(state) {
  if (!state.playing || state.gameOver) return null
  state.tick++

  const before = state.dotsLeft
  updatePac(state)
  const ev = { ateDot: state.dotsLeft !== before }

  if (state.dotsLeft <= 0) {
    state.level++
    resetLevel(state, false)
    ev.levelUp = true
    return ev
  }

  for (const g of state.ghosts) updateGhost(state, g)

  if (caught(state)) {
    state.playing = false
    state.gameOver = true
    ev.caught = true
  }
  return ev
}
