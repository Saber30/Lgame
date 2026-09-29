<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref(null)
let ctx = null
let raf = null
let W = 0
let H = 0
let pets = []

// 像素小人：0=透明 1=头发 2=皮肤 3=衣服 4=裤子 5=鞋
const PALETTE = ['', '#2b2b3a', '#ffd9b3', '#4a90d9', '#2c3e50', '#1a1a1a']

// 两帧：并腿 / 迈腿（走动动画）
const FRAMES = [
  [
    '...1111...',
    '..111111..',
    '..122221..',
    '..122221..',
    '..122221..',
    '...2222...',
    '..333333..',
    '.23333332.',
    '.23333332.',
    '..333333..',
    '..444444..',
    '..44..44..',
    '..44..44..',
    '..55..55..',
  ],
  [
    '...1111...',
    '..111111..',
    '..122221..',
    '..122221..',
    '..122221..',
    '...2222...',
    '..333333..',
    '.23333332.',
    '.23333332.',
    '..333333..',
    '..444444..',
    '.44....44.',
    '.44....44.',
    '.55....55.',
  ],
]

function resize() {
  const c = canvasRef.value
  if (!c) return
  W = c.width = window.innerWidth
  H = c.height = window.innerHeight
}

function makePet() {
  return {
    x: Math.random() * W,
    dir: Math.random() < 0.5 ? 1 : -1,
    speed: 0.5 + Math.random() * 0.9,
    frame: 0,
    frameT: Math.floor(Math.random() * 10),
    px: 2.6 + Math.random() * 0.9,
    bottom: 14 + Math.random() * 40,
  }
}

function drawPet(p) {
  const frame = FRAMES[p.frame]
  const w = frame[0].length * p.px
  const h = frame.length * p.px
  const baseX = p.x
  const baseY = H - p.bottom - h
  ctx.save()
  ctx.translate(baseX, baseY)
  if (p.dir < 0) {
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
  }
  // 脚下阴影
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(w / 2, h + 2, w * 0.42, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  for (let r = 0; r < frame.length; r++) {
    for (let c = 0; c < frame[r].length; c++) {
      const v = frame[r][c]
      if (v === '.') continue
      ctx.fillStyle = PALETTE[Number(v)]
      ctx.fillRect(c * p.px, r * p.px, p.px + 0.4, p.px + 0.4)
    }
  }
  ctx.restore()
}

function loop() {
  ctx.clearRect(0, 0, W, H)
  pets.forEach((p) => {
    p.x += p.dir * p.speed
    if (p.x > W - 24) {
      p.x = W - 24
      p.dir = -1
    }
    if (p.x < 24) {
      p.x = 24
      p.dir = 1
    }
    p.frameT += 1
    if (p.frameT > 9) {
      p.frameT = 0
      p.frame = (p.frame + 1) % FRAMES.length
    }
    drawPet(p)
  })
  raf = requestAnimationFrame(loop)
}

onMounted(() => {
  ctx = canvasRef.value.getContext('2d')
  resize()
  pets = [makePet(), makePet(), makePet()]
  window.addEventListener('resize', resize)
  loop()
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <canvas ref="canvasRef" class="pet-bg" aria-hidden="true"></canvas>
</template>
