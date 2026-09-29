<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { CELL, COLS, MAP, ROWS, createGame, setDirection, start as startGame, stepFrame } from '../game/pacman.js'

const canvasRef = ref(null)
const score = ref(0)
const level = ref(1)
const best = ref(0)
const playing = ref(false)
const gameOver = ref(false)

const game = createGame()
let ctx = null
let raf = null

function syncHud() {
  score.value = game.score
  level.value = game.level
  best.value = game.best
  playing.value = game.playing
  gameOver.value = game.gameOver
}

function draw() {
  ctx.clearRect(0, 0, COLS * CELL, ROWS * CELL)

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP[r][c] === '#') {
        ctx.fillStyle = '#1f4fd8'
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2)
      } else if (game.grid[r][c] === 1) {
        ctx.fillStyle = '#ffd54a'
        ctx.beginPath()
        ctx.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, 2.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  for (const g of game.ghosts) {
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

  const p = game.pac
  const pr = CELL * 0.42
  const mouth = Math.abs(Math.sin(p.mouth)) * 0.28
  let baseAngle = 0
  if (p.dx === -1) baseAngle = Math.PI
  else if (p.dy === -1) baseAngle = -Math.PI / 2
  else if (p.dy === 1) baseAngle = Math.PI / 2
  ctx.fillStyle = '#ffd54a'
  ctx.beginPath()
  ctx.moveTo(p.x, p.y)
  ctx.arc(p.x, p.y, pr, baseAngle + mouth, baseAngle - mouth + Math.PI * 2)
  ctx.closePath()
  ctx.fill()
}

function loop() {
  if (game.playing && !game.gameOver) {
    stepFrame(game)
    syncHud()
  }
  draw()
  raf = requestAnimationFrame(loop)
}

const KEY_DIRS = {
  arrowup: [0, -1],
  w: [0, -1],
  arrowdown: [0, 1],
  s: [0, 1],
  arrowleft: [-1, 0],
  a: [-1, 0],
  arrowright: [1, 0],
  d: [1, 0],
}

function onKey(e) {
  const dir = KEY_DIRS[e.key.toLowerCase()]
  if (!dir) return
  e.preventDefault()
  setDirection(game, dir[0], dir[1])
}

function start() {
  startGame(game)
  syncHud()
}

onMounted(() => {
  const c = canvasRef.value
  c.width = COLS * CELL
  c.height = ROWS * CELL
  ctx = c.getContext('2d')
  window.addEventListener('keydown', onKey)
  syncHud()
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
