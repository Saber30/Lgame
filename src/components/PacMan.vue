<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import {
  CELL,
  COLS,
  MAP,
  ROWS,
  createGame,
  createStepper,
  setDirection,
  setPaused,
  start as startGame,
  togglePause,
} from '../game/pacman.js'

const BEST_KEY = 'lgame-pacman-best'

const canvasRef = ref(null)
const score = ref(0)
const level = ref(1)
const best = ref(0)
const playing = ref(false)
const gameOver = ref(false)
const paused = ref(false)

const game = createGame()
const advance = createStepper(game)
let ctx = null
let raf = null
let savedBest = 0
let lastTs = 0
// 静态图层：墙和豆子都不会每帧变化，预先画到离屏画布，每帧只贴两次图
let wallLayer = null
let dotLayer = null
let dotCtx = null

function syncHud() {
  score.value = game.score
  level.value = game.level
  best.value = game.best
  playing.value = game.playing
  gameOver.value = game.gameOver
  paused.value = game.paused

  if (game.best > savedBest) {
    savedBest = game.best
    try {
      localStorage.setItem(BEST_KEY, String(savedBest))
    } catch (e) {
      /* 隐私模式下 localStorage 可能不可用，忽略即可 */
    }
  }
}

function newLayer() {
  const c = document.createElement('canvas')
  c.width = COLS * CELL
  c.height = ROWS * CELL
  return c
}

function buildWallLayer() {
  wallLayer = newLayer()
  const g = wallLayer.getContext('2d')
  g.fillStyle = '#1f4fd8'
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP[r][c] === '#') g.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2)
    }
  }
}

function buildDotLayer() {
  if (!dotLayer) {
    dotLayer = newLayer()
    dotCtx = dotLayer.getContext('2d')
  }
  dotCtx.clearRect(0, 0, COLS * CELL, ROWS * CELL)
  dotCtx.fillStyle = '#ffd54a'
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (game.grid[r][c] === 1) {
        dotCtx.beginPath()
        dotCtx.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, 2.6, 0, Math.PI * 2)
        dotCtx.fill()
      }
    }
  }
}

/** 吃掉一颗豆子只擦掉那一格，不必重画整层 */
function eraseDot(col, row) {
  dotCtx.clearRect(col * CELL, row * CELL, CELL, CELL)
}

function draw() {
  const w = COLS * CELL
  const h = ROWS * CELL
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(wallLayer, 0, 0)
  ctx.drawImage(dotLayer, 0, 0)

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

  if (game.ready > 0) {
    ctx.fillStyle = 'rgba(255, 213, 74, 0.92)'
    ctx.font = 'bold 22px "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('准备…', w / 2, h / 2)
  }
}

function loop(ts) {
  raf = null
  if (typeof ts !== 'number') ts = performance.now()
  if (!lastTs) lastTs = ts
  const dt = ts - lastTs
  lastTs = ts

  const events = advance(dt)
  let changed = false
  for (const ev of events) {
    if (ev.ateDotAt) eraseDot(ev.ateDotAt.col, ev.ateDotAt.row)
    if (ev.levelUp) buildDotLayer()
    changed = true
  }
  if (changed) syncHud()

  draw()
  // 只有真正在跑的时候才继续排帧：暂停/结束/未开局时循环会自己停下来
  if (game.playing && !game.paused) schedule()
}

function schedule() {
  if (raf === null) raf = requestAnimationFrame(loop)
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
  const k = e.key.toLowerCase()
  if (k === ' ' || k === 'spacebar') {
    e.preventDefault()
    togglePause(game)
    syncHud()
    if (!game.paused) schedule()
    return
  }
  const dir = KEY_DIRS[k]
  if (!dir) return
  e.preventDefault()
  if (game.paused) {
    setPaused(game, false) // 按方向键即继续
    schedule()
  }
  setDirection(game, dir[0], dir[1])
  syncHud()
}

/** 切到别的标签页时自动暂停，免得回来发现已经被抓了 */
function onVisibility() {
  if (document.hidden && game.playing && !game.gameOver) {
    setPaused(game, true)
    syncHud()
  }
}

function start() {
  startGame(game)
  buildDotLayer()
  syncHud()
  schedule()
}

function resume() {
  setPaused(game, false)
  syncHud()
  schedule()
}

onMounted(() => {
  const c = canvasRef.value
  c.width = COLS * CELL
  c.height = ROWS * CELL
  ctx = c.getContext('2d')

  try {
    savedBest = Number(localStorage.getItem(BEST_KEY)) || 0
  } catch (e) {
    savedBest = 0
  }
  game.best = savedBest

  buildWallLayer()
  buildDotLayer()
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVisibility)
  syncHud()
  loop()
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('visibilitychange', onVisibility)
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
      <div v-if="!playing || paused" class="pacman-overlay">
        <template v-if="gameOver">
          <div class="pacman-over-title">被抓住了！</div>
          <div class="pacman-over-sub">得分 {{ score }} · 到达第 {{ level }} 关</div>
          <n-button type="primary" @click="start">再来一局</n-button>
        </template>
        <template v-else-if="paused">
          <div class="pacman-over-title">已暂停</div>
          <div class="pacman-over-sub">按空格或任意方向键继续</div>
          <n-button type="primary" @click="resume">继续</n-button>
        </template>
        <template v-else>
          <div class="pacman-over-title">🎮 吃豆人</div>
          <div class="pacman-over-sub">吃掉所有豆子进入下一关，被幽灵碰到就结束</div>
          <n-button type="primary" @click="start">开始游戏</n-button>
        </template>
      </div>
    </div>
    <p class="pacman-tip">
      方向键 ↑↓←→ 或 W A S D 移动 · 空格暂停 · 切到别的标签页会自动暂停 · 最高分会保存在本机
    </p>
  </div>
</template>
