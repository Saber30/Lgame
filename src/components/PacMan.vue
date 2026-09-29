<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref(null)
const score = ref(0)
const level = ref(1)
const best = ref(0)
const playing = ref(false)
const gameOver = ref(false)

// 地图：'#'=墙 '.'=豆子 ' '=空 'P'=吃豆人起点 'G'=幽灵起点
const MAP = [
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

const COLS = MAP[0].length
const ROWS = MAP.length
const CELL = 24
const SPEED = 1.6

let ctx = null
let raf = null
let grid = []
let pac = null
let ghosts = []
let dotsLeft = 0
let tick = 0
let paused = false

function isWall(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true
  return MAP[row][col] === '#'
}

function resetLevel(fullReset) {
  grid = []
  dotsLeft = 0
  ghosts = []
  for (let r = 0; r < ROWS; r++) {
    const row = []
    for (let c = 0; c < COLS; c++) {
      const ch = MAP[r][c]
      if (ch === '.') {
        row.push(1)
        dotsLeft++
      } else if (ch === 'P') {
        row.push(0)
        pac = { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, dx: 0, dy: 0, ndx: 0, ndy: 0, mouth: 0 }
      } else if (ch === 'G') {
        row.push(0)
        ghosts.push({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, dx: 0, dy: 0, color: '#ff5b5b', speed: SPEED * (0.85 + level.value * 0.03) })
      } else {
        row.push(0)
      }
    }
    grid.push(row)
  }
  // 若地图里没写 P/G，给默认位置
  if (!pac) pac = { x: CELL * 1.5, y: CELL * 1.5, dx: 0, dy: 0, ndx: 0, ndy: 0, mouth: 0 }
  if (!ghosts.length) {
    ghosts.push({ x: (COLS - 2) * CELL, y: CELL * 1.5, dx: 0, dy: 0, color: '#ff5b5b', speed: SPEED * 0.9 })
  }
  if (fullReset) {
    score.value = 0
    level.value = 1
    gameOver.value = false
  }
}

function canMove(x, y, dx, dy) {
  const nx = x + dx * (CELL / 2 + 2)
  const ny = y + dy * (CELL / 2 + 2)
  return !isWall(Math.floor(nx / CELL), Math.floor(ny / CELL))
}

function updatePac() {
  // 尝试转向
  if (pac.ndx !== 0 || pac.ndy !== 0) {
    if (canMove(pac.x, pac.y, pac.ndx, pac.ndy)) {
      pac.dx = pac.ndx
      pac.dy = pac.ndy
      pac.ndx = 0
      pac.ndy = 0
    }
  }
  if (pac.dx !== 0 || pac.dy !== 0) {
    if (canMove(pac.x, pac.y, pac.dx, pac.dy)) {
      pac.x += pac.dx * SPEED
      pac.y += pac.dy * SPEED
      pac.mouth += 0.15
    }
  }
  // 吃豆
  const c = Math.floor(pac.x / CELL)
  const r = Math.floor(pac.y / CELL)
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c] === 1) {
    grid[r][c] = 0
    score.value += 10
    dotsLeft--
    if (score.value > best.value) best.value = score.value
    if (dotsLeft <= 0) {
      level.value++
      resetLevel(false)
    }
  }
}

function updateGhost(g) {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].filter(([dx, dy]) => canMove(g.x, g.y, dx, dy))
  if (!dirs.length) return
  // 70% 概率朝吃豆人靠近，30% 随机
  let pick
  if (Math.random() < 0.7) {
    dirs.sort((a, b) => {
      const da = Math.abs(g.x + a[0] * CELL - pac.x) + Math.abs(g.y + a[1] * CELL - pac.y)
      const db = Math.abs(g.x + b[0] * CELL - pac.x) + Math.abs(g.y + b[1] * CELL - pac.y)
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

function checkCatch() {
  for (const g of ghosts) {
    if (Math.abs(g.x - pac.x) < CELL * 0.7 && Math.abs(g.y - pac.y) < CELL * 0.7) {
      playing.value = false
      gameOver.value = true
      return true
    }
  }
  return false
}

function draw() {
  ctx.clearRect(0, 0, COLS * CELL, ROWS * CELL)
  // 墙 + 豆
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP[r][c] === '#') {
        ctx.fillStyle = '#1f4fd8'
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2)
      } else if (grid[r][c] === 1) {
        ctx.fillStyle = '#ffd54a'
        ctx.beginPath()
        ctx.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, 2.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  // 幽灵
  for (const g of ghosts) {
    const gr = CELL * 0.42
    ctx.fillStyle = g.color
    ctx.beginPath()
    ctx.arc(g.x, g.y - 1, gr, Math.PI, 0)
    ctx.lineTo(g.x + gr, g.y + gr * 0.8)
    ctx.lineTo(g.x + gr * 0.5, g.y + gr * 0.4)
    ctx.lineTo(g.x, g.y + gr * 0.8)
    ctx.lineTo(g.x - gr * 0.5, g.y + gr * 0.4)
    ctx.lineTo(g.x - gr, g.y + gr * 0.8)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(g.x - 3.5, g.y - 3, 3, 0, Math.PI * 2)
    ctx.arc(g.x + 3.5, g.y - 3, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1a1a2e'
    ctx.beginPath()
    ctx.arc(g.x - 3.5 + g.dx * 1.4, g.y - 3 + g.dy * 1.4, 1.4, 0, Math.PI * 2)
    ctx.arc(g.x + 3.5 + g.dx * 1.4, g.y - 3 + g.dy * 1.4, 1.4, 0, Math.PI * 2)
    ctx.fill()
  }
  // 吃豆人
  const pr = CELL * 0.42
  const mouth = Math.abs(Math.sin(pac.mouth)) * 0.28
  let baseAngle = 0
  if (pac.dx === -1) baseAngle = Math.PI
  else if (pac.dy === -1) baseAngle = -Math.PI / 2
  else if (pac.dy === 1) baseAngle = Math.PI / 2
  ctx.fillStyle = '#ffd54a'
  ctx.beginPath()
  ctx.moveTo(pac.x, pac.y)
  ctx.arc(pac.x, pac.y, pr, baseAngle + mouth, baseAngle - mouth + Math.PI * 2)
  ctx.closePath()
  ctx.fill()
}

function loop() {
  if (playing.value && !paused) {
    tick++
    updatePac()
    if (!checkCatch()) {
      for (const g of ghosts) updateGhost(g)
      checkCatch()
    }
  }
  draw()
  raf = requestAnimationFrame(loop)
}

function onKey(e) {
  const k = e.key.toLowerCase()
  const map = {
    arrowup: [0, -1],
    w: [0, -1],
    arrowdown: [0, 1],
    s: [0, 1],
    arrowleft: [-1, 0],
    a: [-1, 0],
    arrowright: [1, 0],
    d: [1, 0],
  }
  if (map[k]) {
    e.preventDefault()
    if (!playing.value) return
    pac.ndx = map[k][0]
    pac.ndy = map[k][1]
  }
}

function start() {
  resetLevel(true)
  playing.value = true
  gameOver.value = false
}

onMounted(() => {
  const c = canvasRef.value
  c.width = COLS * CELL
  c.height = ROWS * CELL
  ctx = c.getContext('2d')
  resetLevel(true)
  window.addEventListener('keydown', onKey)
  loop()
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="pacman-wrap">
    <div class="pacman-hud">
      <span>得分 <b>{{ score }}</b></span>
      <span>关卡 <b>{{ level }}</b></span>
      <span>最高 <b>{{ best }}</b></span>
    </div>
    <div class="pacman-stage">
      <canvas ref="canvasRef" class="pacman-canvas"></canvas>
      <div v-if="!playing" class="pacman-overlay">
        <div v-if="gameOver" class="pacman-over-title">被抓住了！</div>
        <div class="pacman-over-sub">得分 {{ score }} · 到达第 {{ level }} 关</div>
        <n-button type="primary" @click="start">{{ gameOver ? '再来一局' : '开始游戏' }}</n-button>
      </div>
    </div>
    <p class="pacman-tip">用方向键 ↑↓←→ 或 W A S D 控制，吃掉所有豆子进入下一关，被幽灵碰到就结束</p>
  </div>
</template>
